import * as querystring from "querystring";
import {DeviceAppDataBase} from "./../../mobile/device-app-data/device-app-data-base";

export class AppBuilderDeviceAppDataBase extends DeviceAppDataBase implements ILiveSyncDeviceAppData {
	public deviceProjectRootPath: string;

	constructor(_appIdentifier: string,
		public device: Mobile.IDevice,
		public platform: string,
		private $deployHelper: IDeployHelper,
		private $devicePlatformsConstants: Mobile.IDevicePlatformsConstants) {
		super(_appIdentifier);
	}

	public get liveSyncFormat(): string {
		return null;
	}

	public encodeLiveSyncHostUri(hostUri: string): string {
		return querystring.escape(hostUri);
	}

	public getLiveSyncNotSupportedError(): string {
		return `You can't LiveSync on device with id ${this.device.deviceInfo.identifier}! Deploy the app with LiveSync enabled and wait for the initial start up before LiveSyncing.`;
	}

	public isLiveSyncSupported(): IFuture<boolean> {
		return (() => {
			let isApplicationInstalled = this.device.applicationManager.isApplicationInstalled(this.appIdentifier).wait();

			if (!isApplicationInstalled) {
				this.$deployHelper.deploy(this.platform.toString()).wait();
				// Update cache of installed apps
				this.device.applicationManager.checkForApplicationUpdates().wait();
			}

			return this.device.applicationManager.isLiveSyncSupported(this.appIdentifier).wait();
		}).future<boolean>()();
	}
}
