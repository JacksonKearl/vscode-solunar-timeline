
import * as vscode from 'vscode'
import { LunarTimeline } from './LunarTimeline'
import { TodayTimeline } from './TodayTimeline'
import { TidalTimeline } from './TidalTimeline'

export function activate(context: vscode.ExtensionContext) {

	const extUri = context.extensionUri
	const timelines = [new LunarTimeline(extUri), new TodayTimeline(extUri), new TidalTimeline(extUri)]
	context.subscriptions.push(
		...timelines.map(timeline =>
			vscode.workspace.registerTimelineProvider('*', timeline)))
}

export function deactivate() { }
