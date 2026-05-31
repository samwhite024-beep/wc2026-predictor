/**
 * Returns 3 (exact), 1 (correct result), 0 (wrong), or null (not playable yet)
 */
export function calcPoints(homePred, awayPred, homeActual, awayActual) {
  if (homePred == null || awayPred == null) return null
  if (homeActual == null || awayActual == null) return null
  if (homePred === homeActual && awayPred === awayActual) return 3
  const predSign   = Math.sign(homePred - awayPred)
  const actualSign = Math.sign(homeActual - awayActual)
  return predSign === actualSign ? 1 : 0
}

export function pointsLabel(pts) {
  if (pts === 3) return { text: '⭐ Exact',   cls: 'badge-exact'   }
  if (pts === 1) return { text: '✔ Correct',  cls: 'badge-correct' }
  if (pts === 0) return { text: '✖ Wrong',    cls: 'badge-wrong'   }
  return null
}

export const STAGE_ORDER = [
  'Group A','Group B','Group C','Group D','Group E','Group F',
  'Group G','Group H','Group I','Group J','Group K','Group L',
  'Round of 32','Round of 16','Quarter-Final','Semi-Final','3rd Place','Final',
]

export const STAGE_COLORS = {
  'Group A':'#1565C0','Group B':'#2E7D32','Group C':'#E65100','Group D':'#6A1B9A',
  'Group E':'#006064','Group F':'#AD1457','Group G':'#827717','Group H':'#BF360C',
  'Group I':'#4527A0','Group J':'#01579B','Group K':'#33691E','Group L':'#3E2723',
  'Round of 32':'#283593','Round of 16':'#00695C','Quarter-Final':'#4527A0',
  'Semi-Final':'#BF360C','3rd Place':'#4E342E','Final':'#B71C1C',
}

export const FLAGS = {
  'Mexico':'🇲🇽','South Africa':'🇿🇦','Czechia':'🇨🇿','South Korea':'🇰🇷',
  'Canada':'🇨🇦','Bosnia & Herz.':'🇧🇦','Switzerland':'🇨🇭','Qatar':'🇶🇦',
  'Brazil':'🇧🇷','Morocco':'🇲🇦','Scotland':'🏴󠁧󠁢󠁳󠁣󠁴󠁿','Haiti':'🇭🇹',
  'USA':'🇺🇸','Paraguay':'🇵🇾','Australia':'🇦🇺','Turkey':'🇹🇷',
  'Germany':'🇩🇪','Curaçao':'🇨🇼','Ivory Coast':'🇨🇮','Ecuador':'🇪🇨',
  'Netherlands':'🇳🇱','Japan':'🇯🇵','Tunisia':'🇹🇳','Sweden':'🇸🇪',
  'Belgium':'🇧🇪','Iran':'🇮🇷','Egypt':'🇪🇬','New Zealand':'🇳🇿',
  'Spain':'🇪🇸','Uruguay':'🇺🇾','Saudi Arabia':'🇸🇦','Cape Verde':'🇨🇻',
  'France':'🇫🇷','Senegal':'🇸🇳','Norway':'🇳🇴','Iraq':'🇮🇶',
  'Argentina':'🇦🇷','Austria':'🇦🇹','Algeria':'🇩🇿','Jordan':'🇯🇴',
  'Portugal':'🇵🇹','Colombia':'🇨🇴','Uzbekistan':'🇺🇿','DR Congo':'🇨🇩',
  'England':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','Croatia':'🇭🇷','Panama':'🇵🇦','Ghana':'🇬🇭',
}

export function flag(name) {
  return FLAGS[name] ?? '🏳️'
}
