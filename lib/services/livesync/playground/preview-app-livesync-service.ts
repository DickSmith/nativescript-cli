import * as path from "path";
import { FilePayload, Device } from "nativescript-preview-sdk";
import { PreviewSdkEventNames } from "./preview-app-constants";
import { APP_FOLDER_NAME, APP_RESOURCES_FOLDER_NAME, TNS_MODULES_FOLDER_NAME } from "../../../constants";

export class PreviewAppLiveSyncService implements IPreviewAppLiveSyncService {
	constructor(private $fs: IFileSystem,
		private $logger: ILogger,
		private $platformService: IPlatformService,
		private $platformsData: IPlatformsData,
		private $projectDataService: IProjectDataService,
		private $previewSdkService: IPreviewSdkService,
		private $projectFilesManager: IProjectFilesManager,
		private $qrCodeTerminalService: IQrCodeTerminalService) { }

	public async initialSync(data: IPreviewAppLiveSyncData): Promise<void> {
		this.$previewSdkService.initialize();
		this.$previewSdkService.on(PreviewSdkEventNames.DEVICE_CONNECTED, async (device: Device) => {
			this.$logger.trace("Found connected device", device);
			await this.trySyncFilesOnDevice(data, device);
		});
		await this.generateQRCode();
	}

	public async syncFiles(data: IPreviewAppLiveSyncData, files: string[]): Promise<void> {
		for (const device of this.$previewSdkService.connectedDevices) {
			await this.trySyncFilesOnDevice(data, device, files);
		}
	}

	public async stopLiveSync(): Promise<void> {
		this.$previewSdkService.removeAllListeners();
		this.$previewSdkService.stop();
	}

	private async generateQRCode(): Promise<void> {
		this.$qrCodeTerminalService.generate(this.$previewSdkService.qrCodeUrl);
	}

	private async trySyncFilesOnDevice(data: IPreviewAppLiveSyncData, device: Device, files?: string[]): Promise<void> {
		this.$logger.info(`Start syncing changes on device ${device.id}.`);

		try {
			await this.syncFilesOnDevice(data, device, files);
			this.$logger.info(`Successfully synced changes on device ${device.id}.`);
		} catch (err) {
			this.$logger.warn(`Unable to apply changes on device ${device.id}. Error is: ${JSON.stringify(err, null, 2)}.`);
		}
	}

	private async syncFilesOnDevice(data: IPreviewAppLiveSyncData, device: Device, files?: string[]): Promise<void> {
		const { appFilesUpdaterOptions, env, projectDir } = data;
		const platform = device.platform;
		const projectData = this.$projectDataService.getProjectData(projectDir);
		const platformData = this.$platformsData.getPlatformData(platform, projectData);
		
		await this.preparePlatform(platform, appFilesUpdaterOptions, env, projectData);

		const payloads = this.getFilePayloads(platformData, projectData, files);
		await this.$previewSdkService.applyChanges(payloads);
	}

	private getFilePayloads(platformData: IPlatformData, projectData: IProjectData, files?: string[]): FilePayload[] {
		const appFolderPath = path.join(projectData.projectDir, APP_FOLDER_NAME);
		const platformsAppFolderPath = path.join(platformData.appDestinationDirectoryPath, APP_FOLDER_NAME);

		if (files) {
			files = files.map(file => path.join(platformsAppFolderPath, path.relative(appFolderPath, file)));
		} else {
			const excludedProjectDirsAndFiles = [TNS_MODULES_FOLDER_NAME, APP_RESOURCES_FOLDER_NAME, "*.ts", "*.sass", "*.scss", ".less"];
			files = this.$projectFilesManager.getProjectFiles(platformsAppFolderPath, excludedProjectDirsAndFiles);
		}

		const filesToTransfer = files
			.filter(file => file.indexOf(TNS_MODULES_FOLDER_NAME) === -1)
			.filter(file => file.indexOf(APP_RESOURCES_FOLDER_NAME) === -1)
			.filter(file => path.basename(file) !== "main.aot.js")
			.filter(file => path.basename(file) !== ".DS_Store");

		this.$logger.trace(`Transferring ${filesToTransfer.join("\n")}.`);

		const payloads = filesToTransfer
			.map(file => {
				return {
					event: PreviewSdkEventNames.CHANGE_EVENT_NAME,
					file: path.relative(platformsAppFolderPath, file),
					fileContents: this.$fs.readText(file),
					binary: false
				};
			});


		return payloads;
	}

	private async preparePlatform(platform: string, appFilesUpdaterOptions: IAppFilesUpdaterOptions, env: Object, projectData: IProjectData): Promise<void> {
		const nativePrepare = { skipNativePrepare: true };
		const config = <IPlatformOptions>{};
		const platformTemplate = <string>null;
		const prepareInfo = {
			platform,
			appFilesUpdaterOptions,
			env,
			projectData,
			nativePrepare,
			config,
			platformTemplate
		};
		await this.$platformService.preparePlatform(prepareInfo);
	}
}
$injector.register("previewAppLiveSyncService", PreviewAppLiveSyncService);