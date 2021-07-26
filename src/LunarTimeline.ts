import * as vscode from 'vscode'

const msInDay = 86400000
const epochAsJulian = 2440587.5

export const timestampToJulian = (timestamp: number) => (timestamp / msInDay) + epochAsJulian
export const julianToTimestamp = (julian: number) => (julian - epochAsJulian) * msInDay

export enum Phase {
	New,
	Full,
}

export const phaseToLabel = (phase: Phase) => {
	switch (phase) {
		case Phase.New: return 'New Moon'
		case Phase.Full: return 'Full Moon'
		default: throw Error('unexpected phase')
	}
}

export const phaseToIcon = (phase: Phase) => {
	switch (phase) {
		case Phase.New: return 'New.svg'
		case Phase.Full: return 'Full.svg'
		default: throw Error('unexpected phase')
	}
}


export class LunarTimeline implements vscode.TimelineProvider {

	private readonly julianNewMoonReference = 2451550.1;
	private readonly lunarPeriod = 29.530588853;

	onDidChange?: vscode.Event<vscode.TimelineChangeEvent> | undefined;

	id = 'solunar-timeline.lunar-timeline';
	label = 'Lunar Timeline';

	constructor(private extUri: vscode.Uri) { }

	provideTimeline(_uri: vscode.Uri, options: vscode.TimelineOptions, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.Timeline> {
		const { cursor, limit } = options
		if (!limit)
			throw Error('limit is required')

		const cursorTimestamp = cursor ? +cursor : undefined
		const events: { phase: Phase; timestamp: number; }[] = []

		if (typeof limit === 'number') {
			if (cursorTimestamp === undefined) {
				events.push(...this.getLunarEvents(2, Date.now(), 'future').reverse())
				events.push(...this.getLunarEvents(limit - 2, Date.now(), 'past'))
			}
			else {
				events.push(...this.getLunarEvents(limit, cursorTimestamp, 'past'))
			}
		}
		else {
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
				accessibilityInformation: { role: 'checkbox', label: 'hello :)' }
			}))
		}
	}


	private getLunarEvents(limit: number, start: number, direction: 'future' | 'past'): { phase: Phase; timestamp: number; }[] {
		let nearestImportant = (direction === 'future' ? Math.ceil : Math.floor)(this.timestampToPhase(start) * 2) / 2

		if (nearestImportant === this.timestampToPhase(start)) {
			if (direction === 'future') {
				nearestImportant += 0.5
			}
			else {
				nearestImportant -= 0.5
			}
		}

		return Array.from({ length: limit }).map((_, i) => {
			const eventPhase = nearestImportant + (direction === 'future' ? 1 : -1) * 0.5 * i
			const phaseType = Math.round((eventPhase - Math.floor(eventPhase)) * 2)
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
