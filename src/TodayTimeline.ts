import * as vscode from 'vscode'

export class TodayTimeline implements vscode.TimelineProvider, vscode.Disposable {
	private _onDidChange = new vscode.EventEmitter<vscode.TimelineChangeEvent>();
	onDidChange?: vscode.Event<vscode.TimelineChangeEvent> = this._onDidChange.event;
	id = 'solunar-timeline.today-timeline';
	label = 'Today';


	private intervalHandle: NodeJS.Timeout;
	constructor(private extUri: vscode.Uri) {
		this.intervalHandle = setInterval(() => {
			this._onDidChange.fire()
		}, 10000)
	}

	dispose() {
		clearInterval(this.intervalHandle)
	}

	provideTimeline(): vscode.ProviderResult<vscode.Timeline> {
		return {
			items: [{
				timestamp: Date.now() + 10000,
				label: '',
				description: 'Today',
				iconPath: vscode.Uri.joinPath(this.extUri, 'media', 'Empty.svg')
			}],
		}
	}
}
