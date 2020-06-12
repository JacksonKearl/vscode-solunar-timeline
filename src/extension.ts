// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	const extUri = context.extensionUri
	context.subscriptions.push(vscode.workspace.registerTimelineProvider('*', new LunarTimeline(extUri)))
	context.subscriptions.push(vscode.workspace.registerTimelineProvider('*', new TodayTimeline()))

	context.subscriptions.push(vscode.commands.registerCommand('solunar-timeline.log', (...args) => {
		console.log(args)
	}))
}

// this method is called when your extension is deactivated
export function deactivate() { }


const msInDay = 86400000
const epochAsJulian = 2440587.5

const timestampToJulian = (timestamp: number) => (timestamp / msInDay) + epochAsJulian
const julianToTimestamp = (julian: number) => (julian - epochAsJulian) * msInDay

enum Phase {
	New,
	FirstQuarter,
	Full,
	ThirdQuarter
}

const phaseToLabel = (phase: Phase) => {
	switch (phase) {
		case Phase.New: return 'New Moon'
		case Phase.Full: return 'Full Moon'
		case Phase.ThirdQuarter: return 'Third Quarter'
		case Phase.FirstQuarter: return 'First Quarter'
		default: throw Error('unexpected phase')
	}
}

const phaseToIcon = (phase: Phase) => {
	switch (phase) {
		case Phase.New: return 'New.svg'
		case Phase.Full: return 'Full.svg'
		case Phase.ThirdQuarter: return 'Third.svg'
		case Phase.FirstQuarter: return 'First.svg'
		default: throw Error('unexpected phase')
	}
}

class TodayTimeline implements vscode.TimelineProvider, vscode.Disposable {
	private _onDidChange = new vscode.EventEmitter<vscode.TimelineChangeEvent>()
	onDidChange?: vscode.Event<vscode.TimelineChangeEvent> = this._onDidChange.event
	id = 'solunar-timeline.today-timeline'
	label = 'Today'

	private intervalHandle: NodeJS.Timeout;
	constructor() {
		this.intervalHandle = setInterval(() => {
			this._onDidChange.fire()
		}, 10000)
	}

	dispose() {
		clearInterval(this.intervalHandle)
	}

	provideTimeline(): vscode.ProviderResult<vscode.Timeline> {
		return { items: [{ timestamp: Date.now(), label: 'Today' }] }
	}
}

class LunarTimeline implements vscode.TimelineProvider {

	private readonly julianNewMoonReference = 2451550.1;
	private readonly lunarPeriod = 29.530588853;

	onDidChange?: vscode.Event<vscode.TimelineChangeEvent> | undefined;

	id = 'solunar-timeline.lunar-timeline';
	label = 'Lunar Timeline';

	constructor(private extUri: vscode.Uri) { }

	provideTimeline(_uri: vscode.Uri, options: vscode.TimelineOptions, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Timeline> {
		const { cursor, limit } = options
		if (!limit) throw Error('limit is required')

		const cursorTimestamp = cursor ? +cursor : undefined
		const events: { phase: Phase, timestamp: number }[] = []

		if (typeof limit === 'number') {
			if (cursorTimestamp === undefined) {
				events.push(...this.getLunarEvents(4, Date.now(), 'future').reverse())
				events.push(...this.getLunarEvents(limit - 4, Date.now(), 'past'))
			} else {
				events.push(...this.getLunarEvents(limit, cursorTimestamp, 'past'))
			}
		} else {
			throw Error('unexpected config')
		}

		return {
			paging: {
				cursor: '' + (events[events.length - 1].timestamp)
			},
			items: events.map(event => ({
				timestamp: event.timestamp,
				detail: phaseToLabel(event.phase),
				label: '',
				description: new Date(event.timestamp).toDateString().replace(/\d{4}$/, ''),
				iconPath: vscode.Uri.joinPath(this.extUri, 'media', phaseToIcon(event.phase)),
				contextValue: phaseToLabel(event.phase).toLowerCase().replace(/\s/g, '-'),
			}))
		}
	}

	private getLunarEvents(limit: number, start: number, direction: 'future' | 'past'): { phase: Phase, timestamp: number }[] {
		let nearestImportant = (direction === 'future' ? Math.ceil : Math.floor)(this.timestampToPhase(start) * 4) / 4

		if (nearestImportant === this.timestampToPhase(start)) {
			direction === 'future' ? nearestImportant += 0.25 : nearestImportant -= 0.25
		}

		return Array.from({ length: limit }).map((_, i) => {
			const eventPhase = nearestImportant + (direction === 'future' ? 1 : -1) * 0.25 * i
			const phaseType = Math.round((eventPhase - Math.floor(eventPhase)) * 4)
			return { phase: phaseType, timestamp: this.phaseToTimestamp(eventPhase) }
		})
	}

	private phaseToTimestamp(phase: number) {
		const phaseToJulian = (phase: number) => phase * this.lunarPeriod + this.julianNewMoonReference
		return julianToTimestamp(phaseToJulian(phase))
	}

	private timestampToPhase(timestamp: number) {
		const julianToMoonPhase = (julian: number) => (julian - this.julianNewMoonReference) / this.lunarPeriod
		return julianToMoonPhase(timestampToJulian(timestamp))
	}
}