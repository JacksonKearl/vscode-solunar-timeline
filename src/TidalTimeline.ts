import * as vscode from 'vscode'
import axios from 'axios'

const day = 24 * 60 * 60 * 1000

type NOAAPredictions = { predictions: { t: string, v: string, type: 'H' | 'L' }[] }
type Predictions = { timestamp: number, tide: number, type: 'H' | 'L' }[]

const dateToNOAATimestamp = (d: Date): string =>
	`${d.getUTCFullYear()}` +
	`${d.getUTCMonth() + 1}`.padStart(2, '0') +
	`${d.getUTCDate()}`.padStart(2, '0')

const cache: Record<string, Predictions> = {}
export const fetchData = async (station: string): Promise<Predictions> => {
	const today = +new Date()
	const begin_date = dateToNOAATimestamp(new Date(today - day))
	const end_date = dateToNOAATimestamp(new Date(today + day))
	const query = `https://tidesandcurrents.noaa.gov/api/datagetter?product=predictions&application=NOS.COOPS.TAC.WL&begin_date=${begin_date}&end_date=${end_date}&datum=MLLW&station=${station}&time_zone=GMT&units=english&interval=hilo&format=json`
	if (cache[query]) { return cache[query] }
	console.log({ query })
	const resp = await axios.get<NOAAPredictions>(query)
	if (resp.status > 400) {
		throw Error(JSON.stringify(resp.data))
	}

	return cache[query] = resp.data.predictions.map(
		({ t, v, type }) => ({ timestamp: +new Date(t + ' GMT'), tide: +v, type }))
}

export class TidalTimeline implements vscode.TimelineProvider, vscode.Disposable {
	private _onDidChange = new vscode.EventEmitter<vscode.TimelineChangeEvent>();
	onDidChange?: vscode.Event<vscode.TimelineChangeEvent> = this._onDidChange.event;
	id = 'solunar-timeline.tidal-timeline';
	label = 'Tidal Timeline';

	private disposables: vscode.Disposable[] = []
	private station: string

	constructor(private extUri: vscode.Uri) {
		this.station = vscode.workspace.getConfiguration('solunar-timeline').get('station', '')
		this.disposables.push(vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('solunar-timeline.station')) {
				this.station = vscode.workspace.getConfiguration('solunar-timeline').get('station', '')
				this._onDidChange.fire()
			}
		}))
	}

	dispose() {
	}

	async provideTimeline(): Promise<vscode.Timeline> {
		if (!this.station) {
			const task = await vscode.window.showErrorMessage('NOAA Station undefined. Set `solunar-timeline.station` to a NOAA station ID', 'Go to NOAA')
			if (task === 'Go to NOAA') {
				await vscode.env.openExternal(vscode.Uri.parse('https://tidesandcurrents.noaa.gov/'))
			}
			return { items: [] }
		}

		const now = +new Date()
		const start = now - (day / 4)
		const end = now + (3 * day / 4)
		const items = (await fetchData(this.station))
			.map(({ timestamp, tide, type }) => ({
				timestamp,
				label: type,
				description: tide.toFixed(1) + '\''
			}))
			.filter(({ timestamp }) => timestamp > start && timestamp < end)

		console.log(items.map(({ timestamp, description, label }) => ({
			description, label, timestamp: new Date(timestamp).toLocaleString()
		})))

		return { items }
	}
}
