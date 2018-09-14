import * as net from "net";

export class LiveSyncSocket extends net.Socket implements ILiveSyncSocket {
	public uid: string;
	public writeAsync (data: Buffer): Promise<Boolean> {
		return new Promise((resolve, reject) => {

			const result: Boolean = this.write(data, () => resolve(result));
		});
	}
}

$injector.register("LiveSyncSocket", LiveSyncSocket, false);
