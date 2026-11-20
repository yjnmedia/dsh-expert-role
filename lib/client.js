window.__ModuleLoader__.load({
  id: 'dsh-expert-role',
  factory: function (require) {
    var module = { exports: {} }
    var exports = module.exports
    var React = require('react')
    var rawh = React.createElement

    // 界面语言：'zh' 中文，'en' 英文。只翻界面文案；专家名、资料名是库里的数据，原样显示。
    var LANG = 'zh'
    try {
      if (typeof window !== 'undefined' && (window.__EXPERT_ROLE_LANG__ === 'en' || window.__EXPERT_ROLE_LANG__ === 'zh')) {
        LANG = window.__EXPERT_ROLE_LANG__
      }
    } catch (error) {}
    var EN_EXACT = {
      '打开技能说明': 'Opened the skill note',
      '读资料': 'Read a source',
      '更新资料': 'Updated a source',
      '更新调研计划': 'Updated the research plan',
      '派几个帮手': 'Dispatched helpers',
      '合并调研结果': 'Merged research results',
      '开了独立工作区': 'Opened a workspace',
      '把资料收进了专家库': 'Filed a source',
      '今天': 'Today',
      '草稿': 'Draft',
      '调研中': 'Researching',
      '可用': 'Usable',
      '可靠': 'Reliable',
      '权威': 'Authoritative',
      '标杆': 'Exemplary',
      '起步': 'Starting',
      '已归档': 'Archived',
      '未知': 'Unknown',
      '本机脚本': 'Local script',
      '本机脚本写入': 'Local script',
      '技能说明': 'Skill note',
      '专家清单': 'Manifest',
      '调研计划': 'Research plan',
      '资料索引': 'Source index',
      '这位专家': 'this expert',
      '这个主题的资料': 'sources in this topic',
      '资料目录': 'source folder',
      '一次没命名的对话': 'An unnamed conversation',
      '未命名会话': 'Unnamed conversation',
      '按任务找资料': 'Find by task',
      '这位专家是干什么的、现在在补什么': 'What this expert covers, and what it is still filling in',
      '分数怎么算、还差什么': 'How the score is computed, and what is missing',
      '你要做什么，就翻开对应的那一节': 'Find your task, open that section',
      '资料分': 'Content score',
      '使用分': 'Usage score',
      '自测': 'Self-test',
      '重试': 'Retry',
      '清除搜索': 'Clear',
      '调研进度': 'Research progress',
      '进行中': 'running',
      '这里还没有专家': 'No experts here yet',
      '正在读取…': 'Loading…',
      '搜索会话、专家或资料名…': 'Search sessions, experts or files…',
      '缺口': 'Gaps',
      '资料缺口提醒': 'Gap alerts',
      '库里答不上来的比例超过这条线，我就在回复末尾提一句「要不要补」，一位专家一天最多提一次。': 'When the share of questions this library cannot answer passes this line, I mention it once per expert per day.',
      '在': 'on',
      '怎么补': 'How to improve',
      '六项明细（点开看）': 'All six dimensions (click to open)',
      '资料齐不齐': 'Files present',
      '覆盖匀不匀': 'Coverage balance',
      '内容够不够用': 'Content depth',
      '资料新不新': 'Freshness',
      '有没有人真用过': 'Real usage',
      '调研有没有收尾': 'Research closure',
      '这里有什么资料': 'What is in here',
      '还没有能直接翻看的资料文件。': 'No browsable source files yet.',
      '这位专家能帮你什么': 'What this expert helps with',
      '还没有写说明。': 'No description yet.',
      '正在做的事：': 'In progress: ',
      '怎么补：': 'How to improve: ',
      '给开发看的信息': 'For developers',
      '目录名：': 'Folder: ',
      '技能名：': 'Skill name: ',
      '状态：': 'Status: ',
      '为什么是这个星级：': 'Why this rating: ',
      '无': 'None',
      '各项得分：': 'Scores: ',
      '资料分 ': 'Content ',
      '、使用分 ': ', usage ',
      '调研计划：': 'Research plan: ',
      '未定': 'not set',
      '更新于：': 'Updated: ',
      '统计还在算，稍等一下。': 'Still computing, one moment.',
      '近 30 天用了几次资料': 'Sources used in 30 days',
      '含打开专家说明，不含脚本': 'Includes skill notes, excludes scripts',
      '本周读 / 改': 'Read / changed this week',
      '读资料 / 改资料库': 'read / library changes',
      '用过的专家': 'Experts used',
      '在这些对话里用过': 'Used in these conversations',
      '没读过的资料': 'Unread sources',
      '份没被读过': ' files never read',
      '还没开始用。第一次叫专家查资料后，这里开始计数。': 'Nothing here yet. Counting starts after the model first consults an expert.',
      '最近 30 天读资料': 'Sources read in the last 30 days',
      '蓝：读资料': 'Blue: reads',
      '灰：写记录': 'Grey: writes',
      '这 30 天没有读资料的记录。': 'No reads in the last 30 days.',
      '最近 8 周，每天用了几次资料': 'Daily source use over the last 8 weeks',
      '专家成熟到哪一步': 'Where each expert stands',
      '点名字可以跳到那位专家': 'Click a name to jump to that expert',
      '读得最多的资料': 'Most read sources',
      '还没有资料被读过。': 'No source has been read yet.',
      '最近发生的事': 'Recent activity',
      '还没有模型调用记录。': 'No model activity yet.',
      '你的对话': 'Your conversations',
      '还没有使用记录。模型叫专家查资料时，这里按时间倒序列出来。': 'No activity yet. When the model consults an expert, it shows up here newest first.',
      '只看': 'Show',
      '什么时候让模型来查资料': 'When may the model consult the library',
      '默认是「点名才查」：你说「调用生图专家」「查阅阅读器资料库」它才翻库。': 'Default is “only when named”: the model opens the library when you say “call the image expert” or “check the reader library”.',
      '它查资料的时候，什么时候停下来跟你说': 'When it should stop and tell you during research',
      '每查完一份都会在调研记录里留一句小结，面板随时能看。这里选的是「什么时候打断你」。': 'After every source it leaves a one-line note in the research log, visible on the panel anytime. This setting decides when it interrupts you.',
      '推荐的那档会在四种情况下停：新资料推翻原假设、冒出更重要的新主题、连续 2 份没拿到有效结论、查到的和目标对不上。': 'The recommended option stops in four cases: new material contradicts the premise, a more important topic appears, two sources in a row yield nothing useful, or findings drift from the goal.',
      '只在需要转向时停': 'Stop only when direction may change',
      '每查完一份就停': 'Stop after each source',
      '全部查完再汇报': 'Report once at the end',
      '推荐：平时不打扰，只在方向可能要改时停下来问你': 'Recommended: no interruptions unless the direction may change',
      '最稳：每份都汇报一句，等你点头再继续；会比较打断你': 'Safest: report each source and wait for you; interrupts often',
      '最省心：中途不问，跑完一次性说结果': 'Least effort: no interruptions, one report at the end',
      '调研的时候怎么查': 'How research runs',
      '只影响「补资料、做调研」的过程，不影响日常查询。': 'Only affects building up sources and research, not day-to-day lookups.',
      '设置跟着专家库走，换台机器不用重设。': 'Settings travel with the library, no need to redo them on another machine.',
      '自动识别': 'Automatic',
      '模型自己判断相关就查': 'The model decides when a question is relevant',
      '只有你说「调用 / 问问 / 查阅某专家」才查': 'Only when you say “call / ask / check some expert”',
      '库还在，只是模型不会自己来翻；建库、调研照常': 'Library stays; the model just will not consult it on its own. Creating and researching still work.',
      '派几个帮手同时查，回来再合并去重；快，但更费额度': 'Send helpers to research in parallel, then merge. Fast, costs more.',
      '派子智能体同时查（会开临时会话，不记进使用记录）；快，但更费额度': 'Subagents research in parallel (temporary sessions, not counted as usage). Fast, costs more.',
      '自己一条条查，每条回来再调整方向；慢一点，方向更准': 'Search one by one in this conversation, adjusting as results come back. Slower, more accurate.',
      '在当前对话里一条条查，不开任何新会话；慢一点，方向更准': 'Search one by one in this conversation; no new sessions are opened. Slower, more accurate.',
      '暂停使用：等整体做完再开放（会复用同一个会话，不逐条新建）': 'Paused: will reuse a single session; opens after the rest is finished.',
      '自己一条一条查，每条回来再调整方向；慢一点，方向更准': 'Research one by one, adjusting direction after each. Slower, more accurate.',
      '另开一个对话专门调研，不占现在这个对话': 'Open a separate conversation for research, keeping this one free.',
      '同时查': 'Parallel',
      '一条条查': 'One by one',
      '单独开一个对话': 'Separate conversation',
      '自动查': 'Automatic',
      '点名才查': 'Only when named',
      '不自动查': 'Never automatically',
      '各领域的资料按专家放在这里。什么时候让模型来查，去「设置」里选。': 'Domain material is kept one folder per expert. To change when the model may consult it, go to Settings.',
      '概况': 'Overview',
      '专家': 'Experts',
      '调用记录': 'Activity',
      '设置': 'Settings',
      '语言': 'Language',
      '什么时候查资料': 'When may it consult the library',
      '它答不上来的问题（': 'Questions it could not answer (',
      '它答不上来的事（': 'Topics it could not answer (',
      ' 件 / 共 ': ' · ',
      ' 次）': ' asks)',
      ' 最后问过': ' last asked',
      '这些是模型来查时库里没有的。同一件事并成一条，先看有没有人已经做过：做过就「回收」，真空白才「去查」，不属于这位专家就「不用补」。':
        'Questions the library could not answer. Same topic is merged into one line: if someone already solved it, mark "Reuse"; if it is a real blank, "Research"; if it belongs to another expert, "Skip".',
      '回收': 'Reuse',
      '去查': 'Research',
      '不用补': 'Skip',

      '）': ')',
      '（': ' (',
      '」': '”',
      '「': '“',
      '已回收：整理成一条经验': 'Recovered: filed as one method note',
      '已忽略：不属于这位专家或一次性问题': 'Ignored: not this expert, or one-off',
      '已排队：要花额度查新资料': 'Queued: will spend budget to research',
      '已转给「': 'Handed to “',
      '自动处理：回收': 'Auto: recovered',
      '要花额度查新资料，等你点头': 'Needs your go-ahead: spend budget to research',
      '排队去查，不用你处理': 'Queued to research, no action needed',
      '同意去查': 'Approve research',
      '同意去查（': 'Approve research (',
      ' 条）': ' topics)',
      '这些是模型来查时库里没有的。同一件事并成一条；怎么办由它先判断，只有要花额度查新资料时才问你。': 'These are topics the model could not find. Same topic is merged into one row; it decides first and only asks you when new research costs budget.',
      '就是这些提问没查到——补一份资料就少一条；点一条看完整问法': 'These are the questions that found nothing — one new file removes one line.',
      '就是这些提问没查到——补一份资料就少一条；点一条看完整问法': 'These are the questions that found nothing — one new file removes one line.',

      '决定它是主动翻库，还是等你点名——两种都不改动你的资料，只是查不查。': 'Whether it browses on its own or waits for you to name an expert. Nothing in the library changes either way.',
      '模型什么时候来查': 'When the model may consult',
      '补资料 / 做调研时怎么查': 'How research runs when filling gaps',
      '查完怎么跟你说': 'How it reports back',
      '决定它中途停不停、以及库答不上来时要不要在回复末尾提一句。': 'Whether it pauses mid-way, and whether it mentions a missing topic at the end of a reply.',
      '它查资料的时候，什么时候停下来': 'When it should pause while researching',
      '资料缺口提醒的阈值': 'Missing-topic reminder threshold',
      '补资料要不要先问你': 'Ask before filling gaps',
      '补资料会花额度、会往库里写文件，默认每次都要你点头。': 'Filling gaps spends usage and writes into the library, so by default it asks every time.',
      '查到库里没有时': 'When the library has no answer',
      '高级：步数与白名单（': 'Advanced: steps and allow-list (',
      ' 步，': ' steps, ',
      ' 位专家': ' experts',
      '未设白名单': 'no allow-list',
      '一次最多跑几步': 'Max steps per run',
      '放行哪些专家': 'Experts allowed without asking',
      '界面与提醒': 'Language and reminders',
      '只换界面文字与提醒方式；专家名和资料名保持库里原样。': 'Only changes UI text and reminders; expert and file names stay as they are in the library.',
      '界面语言': 'Language',
      '专家库': 'Expert Library',
      '重新读取专家库': 'Reload the expert library',
      '刷新中': 'Refreshing',
      '刷新': 'Refresh',
      '读取失败，请点右上角「刷新」重试。': 'Could not load. Click “Refresh” in the top right to retry.',
      '技术细节': 'Technical details',
      '还没有专家': 'No experts yet',
      '让我给你建第一位，或者把这批调研资料登记进来。': 'Ask me to create the first one, or file a batch of research material.',
      '刚刚': 'just now',
      '月': '-',
      '日': '',
      '与': 'and',
      '跟系统走': 'Follow system',
      '中文': '中文',
      '英文': 'English',
    }

    // 句子是按片段拼出来的，整句翻译用规则匹配，命中不了就保留原文（宁可中英混排，也不丢信息）。
    var EN_RULES = [
      [/^(.+?)，叫来了「(.+?)」专家，读了资料「技能说明」$/, '$1: consulted the "$2" expert, read the skill note'],
      [/^(.+?)，叫来了「(.+?)」专家$/, '$1: consulted the "$2" expert'],
      [/^(.+?)，咨询了「(.+?)」专家，读了资料「(.+?)」$/, '$1: consulted the "$2" expert, read "$3"'],
      [/^(.+?)，咨询了「(.+?)」专家$/, '$1: consulted the "$2" expert'],
      [/^(.+?)，更新了「(.+?)」的调研资料$/, '$1: updated the "$2" expert\'s sources'],
      [/^(.+?)，调整了「(.+?)」的调研步骤$/, '$1: changed the research plan for "$2"'],
      [/^(.+?)，把一份资料收进了「(.+?)」专家库$/, '$1: filed material under the "$2" expert'],
      [/^(.+?)，给「(.+?)」开了一个独立工作区$/, '$1: opened a workspace for "$2"'],
      [/^(.+?)，派几个帮手去查「(.+?)」的资料$/, '$1: dispatched helpers to research "$2"'],
      [/^这里有什么资料 · (\d+) 份（点开看）$/, 'What is in here · $1 files (click to open)'],
      [/^专家 (\d+)$/, 'Experts $1'],
      [/^(\d+) 位专家：(.+)$/, '$1 experts: $2'],
      [/^共 (\d+) 条$/, '$1 entries'],
      [/^找到 (\d+) 条 · 全部 (\d+) 条$/, '$1 of $2 entries'],
      [/^派几个帮手同时查 · 已跑 (.+)$/, 'Research tasks running · $1 elapsed'],
      [/^已完成 (\d+) 步（点开看）$/, '$1 steps done (click to open)'],
      [/^这里还没有调用记录/, 'No activity here yet'],
      [/^六项明细（点开看） · 最弱一项是「(.+?)」$/, 'All six dimensions (click to open) · weakest: "$1"'],
      [/^「(.+?)」专家 ·「(.+?)」$/, '"$1" expert · "$2"'],
      [/^叫来了「(.+)」专家，读了资料「(.+)」$/, 'Consulted the "$1" expert, read "$2"'],
      [/^咨询了「(.+)」专家，读了资料「(.+)」$/, 'Consulted the "$1" expert, read "$2"'],
      [/^叫来了「(.+)」专家$/, 'Consulted the "$1" expert'],
      [/^咨询了「(.+)」专家$/, 'Consulted the "$1" expert'],
      [/^提醒模型：这轮该先查「(.+)」专家资料库$/, 'Reminded the model to check the "$1" library first'],
      [/^提醒模型：这轮该先查「(.+)」资料库$/, 'Reminded the model to check the "$1" library first'],
      [/^派几个帮手去查「(.+)」专家的资料$/, 'Dispatched helpers to research "$1"'],
      [/^给「(.+)」专家开了一个独立工作区$/, 'Opened a separate workspace for "$1"'],
      [/^本机脚本改了「(.+)」专家的资料$/, 'Local script changed sources for "$1"'],
      [/^(\d+) 条记录 · 初始化资料库或跑测试时写入$/, '$1 entries · written while setting up the library or running tests'],
      [/^叫来了「(.+)」$/, 'Consulted the "$1" expert'],
      [/^叫来「(.+)」专家$/, 'Consulted the "$1" expert'],
      [/^咨询了「(.+?)」，读了资料「(.+)」$/, 'Consulted the "$1" expert, read "$2"'],
      [/^咨询了「(.+)」$/, 'Consulted the "$1" expert'],
      [/^更新了「(.+)」的调研资料$/, 'Updated sources for "$1"'],
      [/^调整了「(.+)」的调研步骤$/, 'Updated the research plan for "$1"'],
      [/^把一份资料收进了「(.+)」专家库$/, 'Filed one source into "$1"'],
      [/^给「(.+)」开了一个独立工作区$/, 'Opened a separate workspace for "$1"'],
      [/^提醒模型：这轮该先查「(.+)」资料库$/, 'Reminded the model to check the "$1" library first'],
      [/^派几个帮手去查「(.+)」的资料$/, 'Dispatched helpers to research "$1"'],
      [/^在「(.+)」上做了一次操作$/, 'Made one change on "$1"'],
      [/^派发 · 由「(.+)」发起$/, 'Dispatched by "$1"'],
      [/^派发 · (.+)$/, 'Dispatched · $1'],
      [/^工作区 · (.+)$/, 'Workspace · $1'],
      [/^子任务 · (.+)$/, 'Subtask · $1'],
      [/^上次用到：(.+)$/, 'Last used: $1'],
      [/^更新于 (.+)$/, 'Updated $1'],
      [/^(\d+) 分钟前$/, '$1 min ago'],
      [/^(.+) 小时前$/, '$1 h ago'],
      [/^(\d+)月(\d+)日$/, '$1/$2'],
      [/^(\d+) 个主题 · (\d+) 份资料$/, '$1 topics · $2 files'],
      [/^共 (\d+) 位专家、(\d+) 份资料，其中 (\d+) 份还没被读过。$/, '$1 experts, $2 sources, $3 never read.'],
      [/^近 30 天读 (\d+) 次，写 (\d+) 次$/, '$1 reads, $2 writes in 30 days'],
      [/^(\d+) 步完成$/, '$1 steps done'],
      [/^(\d+) 条记录$/, '$1 entries'],
      [/^(.+)（(\d+) 条记录）$/, '$1 ($2 entries)'],
      [/^(.+)（(\d+) 条）$/, '$1 ($2)'],
      [/^本机脚本（(\d+) 条）$/, 'Local script ($1)'],
      [/^全部记录（(\d+) 条）$/, 'All records ($1)'],
      [/^被读 (\d+) 次$/, 'Read $1 times'],
      [/^(\d+) 份没被读过$/, '$1 never read'],
      [/^用到的专家：(.+)$/, 'Experts used: $1'],
      [/^(\d+) 位$/, '$1'],
      [/^为什么是 (.+)$/, 'Why: $1'],
      [/^；没找到的：(.+)$/, '; not found: $1'],
    ]

    function enText(text) {
      var exact = EN_EXACT[text]
      if (exact !== undefined) return exact
      for (var i = 0; i < EN_RULES.length; i += 1) {
        var hit = EN_RULES[i][0].exec(text)
        if (hit) {
          var out = EN_RULES[i][1]
          for (var g = 1; g < hit.length; g += 1) out = out.split('$' + g).join(hit[g])
          return out
        }
      }
      return text.split('、').join(', ')
    }

    function t(text) {
      if (LANG === 'zh' || typeof text !== 'string') return text
      return enText(text)
    }

    function resolveLang(setting, navLang) {
      if (setting === 'en' || setting === 'zh') return setting
      return /^zh/i.test(String(navLang || '')) ? 'zh' : 'en'
    }

    function localizeChild(child) {
      if (typeof child === 'string') return t(child)
      if (Array.isArray(child)) return child.map(localizeChild)
      return child
    }

    function h() {
      var args = [arguments[0], arguments[1]]
      for (var i = 2; i < arguments.length; i += 1) args.push(localizeChild(arguments[i]))
      return rawh.apply(null, args)
    }
    var useState = React.useState
    var useEffect = React.useEffect
    var useCallback = React.useCallback

    function api(path, init) {
      var options = init || {}
      return fetch(path, {
        method: options.method || 'GET',
        headers: Object.assign({ accept: 'application/json' }, options.body ? { 'content-type': 'application/json' } : {}),
        body: options.body ? JSON.stringify(options.body) : undefined,
      }).then(function (res) {
        return res.json().then(function (json) {
          if (!res.ok) throw new Error(json && json.error ? json.error : 'HTTP ' + res.status)
          return json
        })
      })
    }

    var MUTED = 'var(--dsw-alias-label-secondary, rgba(0,0,0,.55))'
    var BORDER = 'var(--dsw-alias-border-secondary, rgba(0,0,0,.12))'
    var STRONG = 'var(--dsw-alias-label-primary, rgba(0,0,0,.9))'
    var BORDER_STRONG = 'var(--dsw-alias-border-primary, rgba(0,0,0,.28))'
    var TAXONOMY_FALLBACK = ['平台与运行', '工程与交付', '界面与体验', '内容生产', '人工智能', '终端与场景', '业务与运营', '专业技术']
    var FILL = 'var(--dsw-alias-fill-secondary, rgba(0,0,0,.05))'
    var BLUE = 'var(--color-blue-500, #3b82f6)'

    // 尺寸取自 ui-design 专家的 02_视觉与人机工程.md：正文 14/22、标题 15/17、点击区 ≥32、
    // 卡片圆角 8、间距 4px 基准（8/12/16）、状态胶囊高 22、列表行 36–40。
    var styles = {
      gapBadge: { fontSize: 11, color: '#b45309', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 999, padding: '1px 8px', whiteSpace: 'nowrap' },
      topicRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 0',
        borderTop: '1px solid ' + BORDER,
      },
      topicTitle: { fontSize: 13.5, lineHeight: '20px', color: STRONG },
      topicMeta: { fontSize: 12, lineHeight: '18px', color: MUTED, marginTop: 2 },
      topicBtn: {
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid ' + BORDER,
        background: '#fff',
        color: STRONG,
        cursor: 'pointer',
      },
      topicNote: { marginTop: 4, fontSize: 12, lineHeight: '18px', color: '#b45309' },
      topicBtnOn: {
        fontSize: 12,
        padding: '4px 10px',
        borderRadius: 999,
        border: '1px solid #1f6feb',
        background: '#eef4ff',
        color: '#1f6feb',
        fontWeight: 600,
        cursor: 'pointer',
      },
      missRow: { display: 'flex', gap: 10, alignItems: 'baseline', padding: '6px 0', borderTop: '1px solid ' + BORDER },
      missTime: { flex: '0 0 44px', fontSize: 12, color: MUTED, fontVariantNumeric: 'tabular-nums' },
      missText: { flex: 1, minWidth: 0, fontSize: 13, lineHeight: '20px', color: STRONG },
      gapRow: { display: 'flex', flexDirection: 'column', gap: 6, width: '100%', textAlign: 'left', background: 'transparent', border: 0, borderTop: '1px solid ' + BORDER, padding: '12px 0 10px', cursor: 'pointer', font: 'inherit' },
      gapCard: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%', textAlign: 'left', background: 'transparent', border: '1px solid ' + BORDER, borderLeft: '3px solid #cbd5e1', borderRadius: 6, padding: '10px 12px', cursor: 'pointer', font: 'inherit' },
      gapCardMain: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
      gapGroupTitle: { fontSize: 12, fontWeight: 600, color: MUTED, marginBottom: 2 },
      gapHead: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 },
      gapTitle: { fontSize: 14, fontWeight: 600, color: STRONG, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      gapCount: { display: 'flex', alignItems: 'baseline', gap: 4, flex: '0 0 auto' },
      gapNum: { fontSize: 13, fontWeight: 600, color: STRONG, fontVariantNumeric: 'tabular-nums' },
      gapUnit: { fontSize: 12, color: MUTED },
      gapWhy: { fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
      gapBar: { height: 3, borderRadius: 2, background: FILL, overflow: 'hidden' },
      gapBarFill: { height: '100%', borderRadius: 2, background: '#3b82f6' },
      taxoRow: { display: 'grid', gridTemplateColumns: '110px minmax(0, 1fr)', columnGap: 12, alignItems: 'center', minHeight: 44, borderBottom: '1px solid ' + BORDER },
      taxoName: { fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', color: STRONG },
      taxoWho: { fontSize: 13, color: 'var(--dsw-alias-label-primary, #1f2937)' },
      taxoEmpty: { fontSize: 12, color: 'var(--dsw-alias-label-secondary, rgba(0,0,0,.55))' },
      catRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        minHeight: 48,
        padding: '6px 2px',
        border: 'none',
        borderBottom: '1px solid ' + BORDER,
        background: 'none',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
        color: STRONG,
      },
      catName: { flex: '0 0 110px', fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap' },
      catCount: { fontSize: 12, color: MUTED, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' },
      catBack: {
        height: 28,
        padding: '0 10px',
        borderRadius: 6,
        border: '1px solid ' + BORDER,
        background: '#fff',
        color: STRONG,
        font: 'inherit',
        fontSize: 12,
        cursor: 'pointer',
      },
      routerNote: { marginTop: 18, paddingTop: 14, borderTop: '1px solid ' + BORDER, fontSize: 12, lineHeight: '18px', color: MUTED },
      root: { position: 'relative', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, fontSize: 14, lineHeight: 1.57, color: 'var(--dsw-alias-label-primary)' },
      head: { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px 16px 12px' },
      headText: { flex: 1, minWidth: 0 },
      title: { margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.4 },
      lead: { margin: '4px 0 0', fontSize: 13, lineHeight: 1.6, color: MUTED },
      refresh: { flex: '0 0 auto', width: 32, height: 32, borderRadius: 8, border: '1px solid ' + BORDER, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 14 },
      tabs: { display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', borderBottom: '1px solid ' + BORDER },
      pill: { flex: '0 0 auto', height: 26, padding: '0 12px', borderRadius: 13, border: '1px solid ' + BORDER, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 12, lineHeight: '24px' },
      modeBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px', flexWrap: 'wrap' },
      modeLabel: { fontSize: 13, color: MUTED },
      modeBtn: { height: 26, padding: '0 10px', borderRadius: 13, border: '1px solid ' + BORDER, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 12, lineHeight: '24px' },
      chip: { height: 28, padding: '0 11px', borderRadius: 14, border: '1px solid ' + BORDER, background: 'transparent', color: MUTED, cursor: 'pointer', fontSize: 12, lineHeight: '26px' },
      select: { height: 28, padding: '0 8px', borderRadius: 8, border: '1px solid ' + BORDER, background: 'transparent', color: 'var(--dsw-alias-label-primary)', fontSize: 12, maxWidth: 360 },
      chipActive: { borderColor: 'currentColor', color: 'var(--dsw-alias-label-primary)', fontWeight: 600, background: FILL },
      modeBtnActive: { borderColor: 'currentColor', color: 'var(--dsw-alias-label-primary)', fontWeight: 600, background: FILL },
      // 概况页：KPI 4 格（最小 200px，低于就降列）+ 主图 120px 高 + 热力 8×7.
      kpiRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 24, alignItems: 'start' },
      kpiItem: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
      kpiCard: { border: '1px solid ' + BORDER, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4, background: 'transparent' },
      kpiLabel: { fontSize: 12, color: MUTED, whiteSpace: 'nowrap' },
      kpiValue: { fontSize: 26, fontWeight: 600, lineHeight: 1.2, fontVariantNumeric: 'tabular-nums' },
      kpiSub: { fontSize: 11, color: MUTED },
      overviewCols: { display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)', gap: 40, alignItems: 'start' },
      overviewCol: { display: 'flex', flexDirection: 'column', minWidth: 0 },
      taxoChips: { display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0 },
      taxoWait: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 104, height: 28, boxSizing: 'border-box', fontSize: 12, color: MUTED, border: '1px dashed ' + BORDER, borderRadius: 6 },
      recentRow: { display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr)', columnGap: 12, alignItems: 'baseline', padding: '11px 0', borderBottom: '1px solid ' + BORDER },
      moreToggle: { alignSelf: 'flex-start', border: 0, background: 'transparent', color: MUTED, fontSize: 12.5, cursor: 'pointer', padding: '2px 0', font: 'inherit' },
      plainBlock: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
      chart: { display: 'flex', alignItems: 'flex-end', gap: 3, height: 120, paddingTop: 4 },
      barGroup: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 1, height: '100%' },
      bar: { flex: 1, maxWidth: 10, minWidth: 2, borderRadius: '3px 3px 0 0' },
      legend: { display: 'flex', gap: 12, marginTop: 6, fontSize: 12, color: MUTED },
      heatRow: { display: 'flex', gap: 6, overflowX: 'auto' },
      heatGrid: { display: 'flex', gap: 3 },
      heatCol: { display: 'flex', flexDirection: 'column', gap: 3 },
      heatCell: { width: 20, height: 20, borderRadius: '20%' },
      stageRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, lineHeight: '28px' },
      stageName: { width: 36, flex: '0 0 auto', color: MUTED },
      stageTrack: { flex: 1, height: 8, borderRadius: 4, background: FILL, overflow: 'hidden' },
      stageFill: { display: 'block', height: '100%', borderRadius: 4, background: BLUE },
      stageCount: { width: 44, flex: '0 0 auto', textAlign: 'right', color: MUTED, fontVariantNumeric: 'tabular-nums' },
      stageGroup: { display: 'flex', alignItems: 'flex-start', gap: 10, marginTop: 8 },
      stageGroupName: { width: 34, flex: '0 0 auto', fontSize: 12, color: MUTED, paddingTop: 5 },
      chipWrap: { display: 'flex', flexWrap: 'wrap', gap: 6 },
      chip: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: 104, height: 28, boxSizing: 'border-box', fontSize: 12.5, color: STRONG, background: FILL, border: '1px solid ' + BORDER, borderRadius: 6, padding: '0 6px', cursor: 'pointer', font: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
      tab: { padding: '10px 0', fontSize: 14, lineHeight: '22px', background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer' },
      tabActive: { color: 'var(--dsw-alias-label-primary)', fontWeight: 600, boxShadow: 'inset 0 -2px 0 currentColor' },
      summary: { cursor: 'pointer', fontSize: 12 },
      updatedAt: { fontSize: 12, color: MUTED },
      body: { flex: 1, overflow: 'auto', padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: 12, width: '100%', boxSizing: 'border-box' },
      card: { display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid ' + BORDER, borderRadius: 8, padding: '14px 16px', cursor: 'pointer', background: 'transparent' },
      cardOpen: { borderColor: BORDER_STRONG },
      rowTop: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
      cardTitle: { fontSize: 15, fontWeight: 600 },
      metricChip: { display: 'inline-flex', alignItems: 'baseline', gap: 2, height: 22, lineHeight: '22px', padding: '0 9px', borderRadius: 999, background: FILL, fontSize: 12, whiteSpace: 'nowrap' },
      stage: { height: 22, lineHeight: '22px', padding: '0 8px', borderRadius: 999, fontSize: 12, background: FILL, color: 'var(--dsw-alias-label-primary)', whiteSpace: 'nowrap' },
      meta: { fontSize: 13, color: MUTED },
      desc: { fontSize: 14, lineHeight: '22px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' },
      divider: { borderTop: '1px solid ' + BORDER, margin: '4px 0' },
      section: { display: 'flex', flexDirection: 'column', gap: 4 },
      block: { display: 'flex', flexDirection: 'column', gap: 6, border: '1px solid ' + BORDER, borderRadius: 8, background: '#fff', padding: '12px 14px 14px' },
      blockHead: { fontSize: 15, fontWeight: 600, color: STRONG, margin: 0 },
      blockSub: { fontSize: 12, color: MUTED, margin: '2px 0 6px' },
      sectionTitle: { fontSize: 15, fontWeight: 600, lineHeight: '24px', color: 'var(--dsw-alias-label-primary)' },
      sectionSub: { fontSize: 12, color: MUTED, marginTop: 2 },
      bullet: { fontSize: 14, lineHeight: '22px' },
      topicRow: { display: 'grid', gridTemplateColumns: '340px max-content', columnGap: 12, rowGap: 2, alignItems: 'baseline', padding: '8px 0', borderBottom: '1px dashed ' + BORDER, fontSize: 14, lineHeight: '22px' },
      topicName: { fontWeight: 600, whiteSpace: 'nowrap' },
      topicWhy: { flex: 1, minWidth: 0, fontSize: 13, color: MUTED },
      fileRow: { display: 'flex', alignItems: 'baseline', gap: 8, padding: '6px 0', fontSize: 13, cursor: 'pointer' },
      fileMeta: { marginLeft: 'auto', color: MUTED, fontSize: 12, whiteSpace: 'nowrap' },
      pre: { whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7, margin: 0, maxHeight: 420, overflow: 'auto', background: FILL, borderRadius: 6, padding: 12 },
      timelineRow: { display: 'flex', alignItems: 'baseline', gap: 10, padding: '10px 0', borderBottom: '1px dashed ' + BORDER },
      time: { color: MUTED, fontSize: 12, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' },
      sessionPill: { fontSize: 12, padding: '0 8px', height: 22, lineHeight: '22px', borderRadius: 999, background: FILL, color: MUTED, whiteSpace: 'nowrap' },
      strip: { display: 'flex', alignItems: 'flex-end', gap: 4, height: 28 },
      stripBar: { width: 8, borderRadius: 2, background: BLUE },
      stripLabelRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: MUTED, marginTop: 4 },
      tech: { marginTop: 4, fontSize: 12, lineHeight: 1.8, color: MUTED, fontFamily: 'monospace' },
      empty: { padding: '28px 8px', fontSize: 14, lineHeight: 1.7, color: MUTED },
      input: { width: '100%', maxWidth: 360, height: 30, padding: '0 10px', fontSize: 13, color: STRONG, background: FILL, border: '1px solid ' + BORDER, borderRadius: 6, outline: 'none', boxSizing: 'border-box' },
      running: { display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b45309', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 6, padding: '2px 8px', marginTop: 6 },
      stamp: { fontSize: 12, color: MUTED, marginLeft: 'auto' },
      emptyTitle: { display: 'block', fontSize: 15, fontWeight: 600, color: 'var(--dsw-alias-label-primary)', marginBottom: 4 },
      error: { margin: '0 16px', padding: '8px 12px', borderRadius: 6, background: FILL, color: 'var(--dsw-alias-label-danger, #c0392b)', fontSize: 13, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
      link: { background: 'none', border: 'none', padding: 0, font: 'inherit', color: 'var(--dsw-alias-label-danger, #c0392b)', cursor: 'pointer', textDecoration: 'underline' },
      code: { fontFamily: 'monospace', fontSize: 12.5, background: FILL, padding: '1px 5px', borderRadius: 4 },
    }

    var KIND = {
      skill_load: '打开技能说明',
      ref_read: '读资料',
      write: '更新资料',
      plan: '更新调研计划',
      subagent: '派几个帮手',
      merge: '合并调研结果',
      workspace: '开了独立工作区',
      ingest: '把资料收进了专家库',
    }

    function bytesText(bytes) {
      if (!bytes) return ''
      if (bytes < 1024) return bytes + ' B'
      return Math.round(bytes / 1024) + ' KB'
    }

    function dateText(iso) {
      if (!iso) return ''
      var d = new Date(iso)
      if (isNaN(d.getTime())) return ''
      return (d.getMonth() + 1) + '月' + d.getDate() + '日'
    }

    /** 'YYYY-MM-DD' → '10月18日'；'今天' 留给最近一天。 */
    function dayText(day) {
      if (!day) return ''
      var today = new Date()
      var key = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2)
      if (day === key) return '今天'
      var m = String(day).match(/^(\d{4})-(\d{2})-(\d{2})$/)
      if (!m) return String(day)
      return Number(m[2]) + '月' + Number(m[3]) + '日'
    }

    var STATUS_TEXT = { draft: '草稿', surveying: '调研中', ready: '可用', archived: '已归档' }
    var MODE_TEXT = { parallel: '同时查', serial: '一条条查', workspace: '单独开一个对话', auto: '自动查', 'on-request': '点名才查', off: '不自动查' }

    function statusText(value) {
      return STATUS_TEXT[value] || value || '未知'
    }

    function modeText(value) {
      return MODE_TEXT[value] || value || '未知'
    }

    /** 概况「读得最多的资料」一行：资料名（专家）· 被读 N 次；专家 id 造成的行改说「叫来这位专家」。 */
    function topFileText(file, experts) {
      var byId = Object.create(null)
      ;(experts || []).forEach(function (item) { byId[item.id] = item })
      var material = materialName(byId[file.expert], file.path)
      var expertTitle = (byId[file.expert] && byId[file.expert].title) || file.title || file.expert
      if (!file.path || file.path.indexOf('references/') < 0) return '「' + expertTitle + '」专家 ·「技能说明」'
      return '「' + expertTitle + '」专家 ·「' + material + '」'
    }

    /** 派发已跑多久：47 秒 / 1 分 47 秒。 */
    function elapsedText(since) {
      if (!since) return ''
      var at = new Date(since).getTime()
      if (isNaN(at)) return ''
      var sec = Math.max(0, Math.floor((Date.now() - at) / 1000))
      if (sec < 60) return sec + ' 秒'
      return Math.floor(sec / 60) + ' 分 ' + (sec % 60) + ' 秒'
    }

    function agoText(at) {
      if (!at) return ''
      var mins = Math.floor((Date.now() - at) / 60000)
      if (mins <= 0) return '刚刚'
      if (mins < 60) return mins + ' 分钟前'
      return dateText(new Date(at).toISOString()) + ' ' + timeText(new Date(at).toISOString())
    }

    function timeText(iso) {
      if (!iso) return ''
      var d = new Date(iso)
      if (isNaN(d.getTime())) return ''
      return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2)
    }

    /** 把文件路径翻成人话：01-提示词.md → 提示词。 */
    function fileLabel(path) {
      var base = String(path || '').split('/').pop().split('\\').pop()
      var stem = base.replace(/\.(md|json|txt)$/i, '')
      var known = { SKILL: '技能说明', manifest: '专家清单', survey: '调研计划', index: '资料索引' }
      if (known[stem]) return known[stem]
      return stem.replace(/^\d+[-_.\s]*/, '')
    }

    /** 技术文件不进「资料清单」，收进折叠区。 */
    function isTechnical(path) {
      var base = String(path || '').split('/').pop().split('\\').pop()
      return /^(SKILL\.md|manifest\.json|survey\.md|index\.md)$/i.test(base)
    }

    function lastUsedOf(trace, expertId) {
      var latest = null
      ;(trace || []).forEach(function (entry) {
        if (entry.expert !== expertId) return
        if (!latest || String(entry.ts) > String(latest.ts)) latest = entry
      })
      return latest
    }

    /** 没有会话的写入 = 初始化脚本或测试直接写库，不是模型干的。 */
    function isScriptEntry(entry) {
      return !entry || !entry.session
    }

    /** 插件自己开的会话：派发子任务 session-expert-task-* 与工作区 session-expert-<专家>-<毫秒>。 */
    function isChildSession(id) {
      var text = String(id || '')
      if (text.indexOf('session-expert-task-') === 0) return true
      return /^session-expert-(?!task-).+?-\d{10,}$/.test(text)
    }

    /**
     * 句子上下文：把面板已有的专家标题、资料中文名传进来，句子里才能出现人话。
     * buildSentenceCtx(experts) → { names: {专家id: 标题}, materials: {专家id: {相对路径: 中文名}} }
     */
    function buildSentenceCtx(experts) {
      var ctx = { names: Object.create(null), materials: Object.create(null) }
      ;(experts || []).forEach(function (item) {
        if (!item || !item.id) return
        ctx.names[item.id] = item.title || item.id
        ctx.materials[item.id] = item.titles || {}
      })
      return ctx
    }

    /** 目录读（ai-image/references）没有文件名，用主题名；再不行说「这个主题的资料」。 */
    function materialLabel(ctx, entry) {
      var path = String(entry.path || '')
      if (!path) return ''
      var titles = (ctx && ctx.materials && ctx.materials[entry.expert]) || {}
      var at = path.indexOf('references/')
      var rel = at >= 0 ? path.slice(at) : path
      var best = ''
      for (var key in titles) {
        if (rel === key || rel.indexOf(key + '/') === 0) {
          if (!best || key.length > best.length) best = key
        }
      }
      if (best) return titles[best]
      // 目录读：取 references/ 后面那一段（形如 prompt-weighting_20261113）
      var parts = rel.split('/').filter(Boolean)
      if (parts[0] === 'references' && parts.length === 1) return '资料目录'
      if (parts[0] === 'references' && parts.length >= 2) return '资料目录'
      if (/\.[a-z0-9]+$/i.test(parts[parts.length - 1] || '')) return fileLabel(path)
      return '资料目录'
    }

    /** 这句话是谁说的：跟随系统时用会话名，没会话写「本机脚本」。 */
    function whoOf(entry, ctx) {
      if (!ctx || !ctx.withSession) return isScriptEntry(entry) ? '本机脚本' : ''
      var info = ctx.info || {}
      if (isScriptEntry(entry)) return '本机脚本，'
      var name = sessionName(entry, info)
      return name + '，'
    }

    function traceSentence(entry, ctx) {
      var names = (ctx && ctx.names) || {}
      var expertId = entry.expert || ''
      var expertName = names[expertId] || (expertId ? expertId : '这位专家')
      var he = '「' + expertName + '」专家'
      var material = materialLabel(ctx, entry)
      var who = whoOf(entry, ctx)
      var subject = who
      if (entry.kind === 'ref_read') {
        if (material) return subject + '咨询了' + he + '，读了资料「' + material + '」'
        return subject + '咨询了' + he
      }
      if (entry.kind === 'skill_load') {
        return subject + '叫来了' + he + '，读了资料「技能说明」'
      }
      if (entry.kind === 'write') {
        if (subject) return subject + '改了' + he + '的资料'
        return '更新了' + he + '的调研资料'
      }
      if (entry.kind === 'plan') {
        return subject ? subject + '改了' + he + '的调研计划' : '调整了' + he + '的调研步骤'
      }
      if (entry.kind === 'ingest') {
        return subject ? subject + '把一份资料收进了' + he + '专家库' : '把一份资料收进了' + he + '专家库'
      }
      if (entry.kind === 'workspace') {
        return subject ? subject + '给' + he + '开了一个独立工作区' : '给' + he + '开了一个独立工作区'
      }
      if (entry.kind === 'remind') {
        return '提醒模型：这轮该先查' + he + '资料库'
      }
      if (entry.kind === 'miss') {
        var asked = entry.query ? '「' + entry.query + '」' : '那个问题'
        return '在' + he + '资料库里没查到' + asked
      }
      if (entry.kind === 'subagent') return '派几个帮手去查' + he + '的资料'
      return (subject || '') + '在' + he + '上做了一次操作'
    }

    /** 会话标题表与会话归属表：subagent 记录里的 children 指回发起它的对话。 */
    function sessionInfo(trace) {
      var title = {}
      var parent = {}
      ;(trace || []).forEach(function (entry) {
        if (entry.session && entry.sessionTitle) title[entry.session] = entry.sessionTitle
        if (entry.kind === 'subagent' && entry.session) {
          (entry.children || []).forEach(function (child) { parent[child] = entry.session })
        }
      })
      return { title: title, parent: parent }
    }

    function sessionName(entry, info) {
      var id = String((entry && entry.session) || '')
      if (!id) return '本机脚本写入'
      info = info || { title: {}, parent: {} }
      var mine = info.title[id] || (entry && entry.sessionTitle) || ''
      if (id.indexOf('session-expert-task-') === 0) {
        var from = info.parent[id] ? info.title[info.parent[id]] || '' : ''
        if (from) return '派发 · 由「' + from + '」发起'
        return '派发 · ' + (mine || '子任务')
      }
      if (isChildSession(id)) {
        var ws = id.match(/^session-expert-(.+?)-\d{10,}$/)
        return '工作区 · ' + (mine || (ws ? ws[1] : '调研'))
      }
      return mine || '一次没命名的对话'
    }

    /** 把会话分成「你的对话」和「插件自己开的」两组，供下拉分组。 */
    function sessionGroups(trace) {
      var info = sessionInfo(trace)
      var seen = {}
      var users = []
      var children = []
      ;(trace || []).forEach(function (entry) {
        var key = entry.session || ''
        if (!key || seen[key]) return
        seen[key] = true
        var option = { key: key, label: sessionName(entry, info) }
        if (isChildSession(key)) children.push(option)
        else users.push(option)
      })
      return { users: users, children: children }
    }

    /** 资料的中文名取自 manifest.titles；查不到再退回文件名。 */
    function materialName(expert, path) {
      var titles = (expert && expert.titles) || {}
      var at = String(path || '').indexOf('references/')
      var rel = at >= 0 ? String(path).slice(at) : String(path || '')
      var best = ''
      for (var key in titles) {
        if (rel === key || rel.indexOf(key + '/') === 0) {
          if (!best || key.length > best.length) best = key
        }
      }
      if (best) return titles[best]
      return fileLabel(path)
    }

    function filesOfTopics(topics) {
      var seen = {}
      var out = []
      ;(topics || []).forEach(function (topic) {
        ;(topic.files || []).forEach(function (file) {
          if (seen[file]) return
          seen[file] = true
          out.push(file)
        })
      })
      return out
    }

    /** 阶段 + 星级一起显示，例如「★★★☆ 齐全」；鼠标悬停给出判据。 */
    function stageText(expert) {
      var level = expert && expert.stage ? expert.stage : '起步'
      var score = expert && expert.maturity ? expert.maturity.score : null
      var label = expert && expert.stars ? expert.stars + ' ' + level : level
      return score === null ? label : label + '（' + score + '/100）'
    }

    function SectionTitle(props) {
      return h(
        'div',
        null,
        h('div', { style: styles.sectionTitle }, props.title || (Array.isArray(props.children) ? props.children.join('') : props.children)),
        props.sub ? h('div', { style: styles.sectionSub }, props.sub) : null,
      )
    }

    function TopicList(props) {
      var topics = props.topics || []
      if (topics.length === 0) {
        return h('div', { style: { fontSize: 13, color: MUTED } }, '还没有按主题整理。')
      }
      return h(
        'div',
        null,
        topics.map(function (topic) {
          var count = (topic.files || []).length
          return h(
            'div',
            { key: topic.id || topic.title, style: styles.topicRow },
            h('span', { style: styles.topicName }, topic.title || topic.id),
            h('span', { style: styles.topicWhy }, topic.whenToUse || ''),
            h('span', { style: { fontSize: 12, color: MUTED, whiteSpace: 'nowrap' } }, count + ' 份'),
          )
        }),
      )
    }

    // 「需要补的资料」（用户 2026-11-17 要求）：缺口必须出现在首页，而不是只在会话里转述。
    function gapRowsOf(experts, trace) {
      var rows = []
      var list = experts || []
      for (var i = 0; i < list.length; i += 1) {
        var expert = list[i] || {}
        var info = expert.gap || {}
        var misses = Number(info.misses || 0)
        if (!misses) continue
        var examples = []
        var seen = Object.create(null)
        var entries = trace || []
        for (var j = entries.length - 1; j >= 0; j -= 1) {
          var entry = entries[j] || {}
          if (entry.kind !== 'miss' || entry.expert !== expert.id) continue
          var query = String(entry.query || '').trim()
          if (!query || seen[query]) continue
          seen[query] = true
          examples.push(query)
          if (examples.length >= 2) break
        }
        rows.push({
          id: expert.id,
          title: expert.title || expert.id,
          misses: misses,
          gap: Number(info.gap || 0),
          examples: examples,
        })
      }
      rows.sort(function (a, b) { return b.misses - a.misses || b.gap - a.gap })
      return rows
    }

    function percentText(value) {
      return Math.round(Number(value || 0) * 100) + '%'
    }

    // 某位专家被问空过的全部问题（去重，最近优先），面板用它把「几次」变成「哪几句」。
    function missesOf(trace, expertId) {
      var seen = {}
      var rows = []
      ;(trace || [])
        .slice()
        .reverse()
        .forEach(function (entry) {
          if (!entry || entry.kind !== 'miss' || entry.expert !== expertId) return
          var q = (entry.query || '').trim()
          if (!q || seen[q]) return
          seen[q] = true
          rows.push({ query: q, ts: entry.ts })
        })
      return rows
    }

    function ExpertCard(props) {
      var expert = props.expert
      var topics = expert.topics || []
      var fileCount = filesOfTopics(topics).length
      var last = props.last
      var lastLine = last
        ? '上次用到：' + dateText(last.ts) + ' ' + timeText(last.ts)
        : '还没用过'
      return h(
        'div',
        {
          id: 'expert-card-' + expert.id,
          style: Object.assign({}, styles.card, props.open ? styles.cardOpen : {}),
          onClick: props.onToggle,
          role: 'button', },
        h(
          'div',
          { style: styles.rowTop },
          h('span', { style: styles.cardTitle }, expert.title || expert.id),
          h('span', { style: styles.stage, title: expert.stageHint || '' }, stageText(expert)),
          h('span', { style: styles.meta }, topics.length + ' 个主题 · ' + fileCount + ' 份资料'),
          expert.gap && expert.gap.misses > 0
            ? h('span', { style: styles.gapBadge, title: '有 ' + expert.gap.misses + ' 次提问在库里没找到资料' }, '答不上 ' + expert.gap.misses + ' 次')
            : null,
        ),
        expert.description ? h('div', { style: styles.desc }, expert.description) : null,
        h('div', { style: styles.meta }, lastLine),
        expert.runningSince
          ? h('div', { style: styles.running }, '派几个帮手同时查 · 已跑 ' + elapsedText(expert.runningSince))
          : null,
        props.open ? h(ExpertDetail, props) : null,
      )
    }

    function ExpertDetail(props) {
      var queuedState = useState({})
      var queued = queuedState[0]
      var setQueued = queuedState[1]
      var handledOpenState = useState(false)
      var handledOpen = handledOpenState[0]
      var setHandledOpen = handledOpenState[1]
      var expert = props.expert
      var issueTotal = (expert.issues && expert.issues.issues || []).length
      var topics = expert.topics || []
      var files = (props.files || []).filter(function (f) { return !isTechnical(f.path) })
      var steps = expert.steps || []
      var done = steps.filter(function (s) { return s.done }).length

      function decideTopic(item, action) {
        // 点了就先把反馈给出来，不等后端回包；真的开会话在后端，跑起来会有「正在查 · 几秒」。
        if (action === 'research' && item.decision !== 'research') {
          var stamp = {}
          stamp[item.key] = Date.now()
          setQueued(Object.assign({}, queued, stamp))
        }
        props.onGapDecision?.(expert.id, item.key, item.decision === action ? null : action)
        if (action === 'research' && item.decision !== 'research') {
          props.onGapResearch?.(expert.id, item.key, item.text || item.key)
        }
      }

      function runOf(item) {
        var runs = props.gapRuns || {}
        var run = runs[expert.id + '\u0000' + item.key]
        return run || null
      }

      function runNote(item) {
        var run = runOf(item)
        if (!run) return ''
        var ms = run.startedAt
          ? Math.max(0, (run.endedAt ? Date.parse(run.endedAt) : Date.now()) - Date.parse(run.startedAt))
          : 0
        var secs = Math.max(1, Math.round(ms / 1000))
        if (run.status === 'running') {
          var note = run.diagnosis && run.diagnosis.text
          if (note && run.diagnosis.code !== 'running') return t('正在查 · 已跑 ') + secs + t(' 秒 · ') + note
          return t('正在查 · 已跑 ') + secs + t(' 秒')
        }
        if (run.status === 'failed') return t('查失败了：') + (run.error || t('未知原因'))
        var done = t('查完了 · 用了 ') + secs + t(' 秒')
        var added = Number(run.added) || 0
        if (run.registered === true && added > 0) return done + t(' · 补了 ') + added + t(' 份，登记齐了')
        if (run.registered === false && added > 0) {
          var missing = (run.files || []).filter(function (f) { return !f.inIndex || !f.inManifest }).length
          return done + t(' · 补了 ') + added + t(' 份，有 ') + missing + t(' 份没登记')
        }
        if (run.registered === false) return done + t(' · 没看到新写的资料')
        return done
      }

      function queuedAt(item) {
        if (item.decision === 'research') return 0
        return queued[item.key] || 0
      }

      function topicStatus(item) {
        if (item.decision === 'recover') return { text: t('已回收：整理成一条经验'), tone: 'done' }
        if (item.decision === 'ignore') return { text: t('已忽略：不属于这位专家或一次性问题'), tone: 'done' }
        if (item.decision === 'research') {
          var note = runNote(item)
          if (note) return { text: note, tone: 'wait' }
          return { text: t('已排队 · 马上开查'), tone: 'wait' }
        }
        var auto = item.auto || {}
        if (auto.action === 'handoff') {
          return { text: t('已转给「') + auto.to + t('」') + (auto.why ? t('（') + auto.why + t('）') : ''), tone: 'auto' }
        }
        if (auto.action === 'recover') {
          return { text: t('自动处理：回收') + (auto.why ? t('（') + auto.why + t('）') : ''), tone: 'auto' }
        }
        return { text: item.needsApproval ? t('要花额度查新资料，等你点头') : t('排队去查，不用你处理'), tone: 'wait' }
      }

      function missesBlock() {
        var rows = expert.gapTopics || []
        if (rows.length === 0) return null
        var total = rows.reduce(function (sum, item) { return sum + (item.count || 0) }, 0)
        // 已处理的（回收 / 去查 / 转交 / 不用补）排到最后并折叠，正文只留还要它处理的。
        var isHandled = function (item) {
          // 「同意去查」只是排队，还没真的查，所以仍然留在正文里让人看到进度。
          if (item.decision === 'research') return false
          if (item.decision) return true
          return Boolean(item.auto && item.auto.action === 'handoff')
        }
        var active = rows.filter(function (item) { return !isHandled(item) })
        var handled = rows.filter(isHandled)
        var handledTimes = handled.reduce(function (sum, item) { return sum + (item.count || 0) }, 0)
        var needApprove = active.filter(function (item) { return item.needsApproval && item.decision !== 'research' }).length
        var queuedCount = active.filter(function (item) { return item.decision === 'research' }).length
        return h(
          'div',
          { id: 'expert-gap-' + expert.id, style: Object.assign({}, styles.section, { borderRadius: 8 }) },
          h(
            SectionTitle,
            {
              sub: t('这些是模型来查时库里没有的。同一件事并成一条；怎么办由它先判断，只有要花额度查新资料时才问你。'),
            },
            t('它答不上来的事（') +
              active.length +
              t(' 件 / 共 ') +
              active.reduce(function (sum, item) { return sum + (item.count || 0) }, 0) +
              t(' 次）'),
          ),
          needApprove > 0
            ? h(
              'div',
              { style: { margin: '0 0 6px' } },
              h(
                'button',
                {
                  type: 'button',
                  style: styles.topicBtn,
                  onClick: function () {
                    rows.forEach(function (item) {
                      if (item.needsApproval && !item.decision) props.onGapDecision?.(expert.id, item.key, 'research')
                    })
                  },
                },
                t('同意去查（') + needApprove + t(' 条）'),
              ),
            )
            : null,
          queuedCount > 0
            ? h(
              'div',
              { style: { fontSize: 12, color: MUTED, margin: '2px 0 6px' } },
              t('已排队 ') + queuedCount + t(' 条，还没开查；开查时会在一个新工作区里跑，跑起来这里会显示进度。'),
            )
            : null,
          active.map(function (item, index) {
            var status = topicStatus(item)
            var pending = item.decision === 'research' || Boolean(queued[item.key])
            return h(
              'div',
              { key: 'topic-' + index, style: styles.topicRow },
              h('div', { style: styles.topicTitle }, item.title + (item.count > 1 ? '（' + item.count + t(' 次）') : '')),
              item.needsApproval || pending
                ? h(
                  'button',
                  {
                    type: 'button',
                    disabled: pending,
                    style: Object.assign({}, styles.topicBtn, {
                      justifySelf: 'start',
                      justifyItems: 'start',
                      opacity: pending ? 0.55 : 1,
                      cursor: pending ? 'default' : 'pointer',
                    }),
                    onClick: function () { if (!pending) decideTopic(item, 'research') },
                  },
                  pending ? t('已排队 · 等开查') : t('同意去查'),
                )
                : h('span', null),
              h('div', { style: Object.assign({}, styles.topicMeta, { gridColumn: '1 / -1' }) }, timeText(item.lastTs) + t(' 最后问过')),
              h(
                'div',
                {
                  style: Object.assign(
                    {},
                    styles.topicNote,
                    { gridColumn: '1 / -1' },
                    status.tone === 'auto' ? { color: MUTED } : null,
                    status.tone === 'done' ? { color: '#15803d' } : null,
                  ),
                },
                status.text,
              ),
            )
          }),
          handled.length > 0
            ? h(
              'button',
              {
                type: 'button',
                style: Object.assign({}, styles.topicBtn, { justifySelf: 'start', alignSelf: 'flex-start', width: 'auto', padding: '0 12px' }),
                onClick: function (event) {
                  if (event && event.stopPropagation) event.stopPropagation()
                  setHandledOpen(!handledOpen)
                },
              },
              (handledOpen ? t('收起已处理的 ') : t('已处理 ')) + handled.length + t(' 件 / 共 ') + handledTimes + t(' 次') + (handledOpen ? '' : t('（点开看）')),
            )
            : null,
          handledOpen
            ? handled.map(function (item, index) {
                var status = topicStatus(item)
                return h(
                  'div',
                  { key: 'handled-' + index, style: Object.assign({}, styles.topicRow, { opacity: 0.75 }) },
                  h('div', { style: styles.topicTitle }, item.title + (item.count > 1 ? '（' + item.count + t(' 次）') : '')),
                  h('div', { style: styles.topicMeta }, timeText(item.lastTs) + t(' 最后问过')),
                  h(
                    'div',
                    { style: Object.assign({}, styles.topicNote, { gridColumn: '1 / -1' }) },
                    status ? status.text : t('已处理'),
                  ),
                )
              })
            : null,
        )
      }

      function maturityBlock() {
        var m = expert.maturity
        if (!m) return null
        var DIMS = { D1: '资料齐不齐', D2: '覆盖匀不匀', D3: '内容够不够用', D4: '资料新不新', D5: '有没有人真用过', D6: '调研有没有收尾' }
        var dims = m.dims || {}
        var notes = m.notes || {}
        var keys = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']
        var weakest = ''
        keys.forEach(function (key) {
          if (!notes[key]) return
          if (!weakest || (dims[key] || 0) < (dims[weakest] || 0)) weakest = key
        })
        var chips = [
          { label: '资料分', value: m.contentScore },
          { label: '使用分', value: m.usageScore },
          m.queries ? { label: '自测', value: m.queries.hit + '/' + m.queries.total } : null,
          expert.gap && expert.gap.known ? { label: '缺口', value: Math.round(expert.gap.gap * 100) + '%' } : null,
        ].filter(Boolean)
        return h(
          'div',
          { style: styles.section },
          h(SectionTitle, { sub: '分数怎么算、还差什么' }, '为什么是 ' + (expert.stars || '') + '（' + (expert.stage || '起步') + '）'),
          h(
            'div',
            { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 } },
            chips.map(function (chip) {
              return h(
                'span',
                { key: chip.label, style: styles.metricChip },
                h('span', { style: { color: MUTED } }, t(chip.label) + ' '),
                h('span', { style: { fontWeight: 600, fontVariantNumeric: 'tabular-nums' } }, String(chip.value)),
              )
            }),
          ),
          m.hint ? h('div', { style: { fontSize: 13, color: STRONG, lineHeight: 1.7, marginTop: 6 } }, m.hint) : null,
          m.queries && m.queries.text ? h('div', { style: { fontSize: 12, color: MUTED, marginTop: 4 } }, m.queries.text) : null,
          m.staleCount > 0
            ? h(
                'div',
                { style: { fontSize: 12, color: MUTED, marginTop: 2 } },
                '该复核的旧资料 ' + m.staleCount + ' 份：' + (m.staleFiles || []).slice(0, 3).map(function (item) { return fileLabel(item.rel) + '（' + item.days + ' 天没动）' }).join('、'),
              )
            : null,
          h(
            'details',
            { style: { marginTop: 4 } },
            h(
              'summary',
              { style: { cursor: 'pointer', fontSize: 12, color: MUTED } },
              '六项明细（点开看）' + (weakest && notes[weakest] ? ' · 最弱一项是「' + (DIMS[weakest] || weakest) + '」' : ''),
            ),
            h(
              'div',
              { style: { marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 } },
              keys.map(function (key) {
                var note = notes[key]
                if (!note) return null
                var value = Math.round((dims[key] || 0) * 100) + '%'
                var low = (dims[key] || 0) < 0.6
                var isWeakest = key === weakest
                return h(
                  'div',
                  { key: key, style: { display: 'flex', flexDirection: 'column', gap: 2, marginTop: isWeakest ? 4 : 0 } },
                  h(
                    'div',
                    { style: { display: 'flex', gap: 8, alignItems: 'baseline' } },
                    h('span', { style: { flex: '0 0 96px', fontSize: 13, color: MUTED } }, DIMS[key] || key),
                    h('span', { style: { flex: '0 0 42px', fontSize: 13, fontVariantNumeric: 'tabular-nums', color: low ? '#c2410c' : STRONG } }, value),
                    h('span', { style: { flex: 1, minWidth: 0, fontSize: 13, color: low ? '#c2410c' : MUTED, lineHeight: 1.6 } }, note.text),
                  ),
                  isWeakest && note.fix
                    ? h('div', { style: { marginLeft: 104, fontSize: 13, color: STRONG, lineHeight: 1.6 } }, '怎么补：' + note.fix)
                    : null,
                )
              }),
            ),
          ),
        )
      }

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 20, cursor: 'default' }, onClick: function (e) { e.stopPropagation() } },
        h(
          'div',
          { style: styles.section },
          h(SectionTitle, { sub: '这位专家是干什么的、现在在补什么' }, '这位专家能帮你什么'),
          h('div', { style: styles.bullet }, expert.description || '还没有写说明。'),
          expert.goal ? h('div', { style: { fontSize: 13, color: MUTED } }, '正在做的事：' + expert.goal) : null,
        ),
        missesBlock(),
        maturityBlock(),
        h(
          'div',
          { style: styles.section },
          h(SectionTitle, { sub: '你要做什么，就翻开对应的那一节' }, '按任务找资料'),
          h(TopicList, { topics: topics }),
        ),
        h(
          'div',
          { style: styles.section },
          h(SectionTitle, { sub: '做完的收起来，只摆正在做的那一步' }, '调研进度'),
          steps.length === 0
            ? h('div', { style: { fontSize: 13, color: MUTED } }, '这里还没排调研计划。')
            : steps.map(function (step, index) {
                if (step.done) return null
                return h(
                  'div',
                  { key: 's' + index, style: { display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 } },
                  h('span', { style: { color: MUTED } }, '◻'),
                  h('span', { style: { flex: 1, minWidth: 0 } }, step.text || ('第 ' + step.index + ' 步')),
                  h('span', { style: { fontSize: 12, color: '#b45309' } }, '进行中'),
                )
              }),
          done > 0
            ? h(
                'details',
                { style: { marginTop: 6 } },
                h('summary', { style: { cursor: 'pointer', fontSize: 12, color: MUTED } }, '已完成 ' + done + ' 步（点开看）'),
                h(
                  'div',
                  { style: { marginTop: 6, fontSize: 12.5, color: MUTED, lineHeight: 1.9 } },
                  steps.map(function (step, index) {
                    if (!step.done) return null
                    return h('div', { key: 'd' + index }, '☑ ' + (step.text || ('第 ' + step.index + ' 步')))
                  }),
                ),
              )
            : null,
        ),
        h(
          'details',
          null,
          h(
            'summary',
            { style: { cursor: 'pointer', fontSize: 12, color: MUTED } },
            '这里有什么资料 · ' + files.length + ' 份（点开看）' + (issueTotal > 0 ? ' · 有 ' + issueTotal + ' 处清单对不上' : ''),
          ),
          issueTotal > 0
            ? h(
                'div',
                { style: { marginTop: 6, fontSize: 12, color: MUTED, lineHeight: 1.7 } },
                h('div', null, '清单和磁盘对不上的地方（只标记，不影响使用）：'),
                (expert.issues.issues || []).slice(0, 6).map(function (issue) {
                  return h('div', { key: issue.kind + issue.path }, '· ' + issue.detail + '：' + issue.path)
                }),
                issueTotal > 6 ? h('div', null, '· 还有 ' + (issueTotal - 6) + ' 处没列出来') : null,
              )
            : null,
          files.length === 0
            ? h('div', { style: { fontSize: 13, color: MUTED, marginTop: 6 } }, '还没有能直接翻看的资料文件。')
            : h(
                'div',
                { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '0 16px', marginTop: 4 } },
                files.map(function (file) {
                  return h(
                    'div',
                    { key: file.path, style: styles.fileRow, onClick: function () { props.onOpen(file.path) }, role: 'button', title: materialName(expert, file.path) },
                    h('span', { style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, materialName(expert, file.path)),
                    h('span', { style: styles.fileMeta }, bytesText(file.bytes)),
                  )
                }),
              ),
        ),
        props.content
          ? h(
              'div',
              { style: styles.section },
              h(SectionTitle, null, fileLabel(props.content.path)),
              h('pre', { style: styles.pre }, String(props.content.content || '').slice(0, 20000)),
            )
          : null,
        h(
          'details',
          null,
          h('summary', { style: { cursor: 'pointer', fontSize: 12, color: MUTED } }, '给开发看的信息'),
          h(
            'div',
            { style: styles.tech },
            h('div', null, '目录名：' + expert.id),
            h('div', null, '技能名：' + expert.skillName),
            h('div', null, '状态：' + statusText(expert.status) + '　调研方式：' + modeText(expert.mode)),
            h('div', null, '为什么是这个星级：' + (expert.stageHint || '无')),
            h('div', null, '各项得分：' + (expert.maturity ? '资料分 ' + expert.maturity.contentScore + '、使用分 ' + expert.maturity.usageScore : '无')),
            h('div', null, '调研计划：' + (steps.length === 0 ? '未定' : done + '/' + steps.length + ' 步完成')),
            h('div', null, '更新于：' + (dateText(expert.updatedAt) + ' ' + timeText(expert.updatedAt)).trim()),
          ),
        ),
      )
    }

    var STAGE_COLOR = { '起步': '#93c5fd', '可用': '#3b82f6', '可靠': '#1d4ed8', '权威': '#1e3a8a', '标杆': '#111827' }

    function stageHintOf(item) {
      var m = item.maturity || {}
      return (item.stage || '起步') + (typeof m.score === 'number' ? ' · ' + m.score + ' 分' : '')
    }

    function OverviewTab(props) {
      var moreState = useState(false)
      var stats = props.stats
      var experts = props.experts || []
      var sentenceCtx = Object.assign({ withSession: true, info: sessionInfo(props.trace || []) }, buildSentenceCtx(experts))
      if (!stats) return h('div', { style: styles.empty }, props.loading ? '正在读取…' : '这里还没有统计。等模型用过一次资料，这里就有数了。')
      var totals = stats.totals || {}
      var reads = totals.readsInWindow || 0
      var recent = (props.trace || [])
        .filter(function (entry) { return !isScriptEntry(entry) })
        .slice()
        .sort(function (a, b) { return String(b.ts) > String(a.ts) ? 1 : -1 })
        .slice(0, 5)
      var files = (stats.perFile || []).slice().sort(function (a, b) { return b.uses - a.uses })

      var kpis = [
        { label: '近 30 天读资料', value: String(reads), sub: '含打开专家说明，不含脚本' },
        { label: '本周读 / 改', value: (totals.readsThisWeek || 0) + ' / ' + (totals.writesThisWeek || 0), sub: '读资料 / 改资料库' },
        { label: '用过的专家', value: (totals.expertsUsed || 0) + ' / ' + (totals.expertsTotal || 0), sub: '在这些对话里用过' },
        { label: '没读过的资料', value: (totals.unusedFiles || 0) + ' / ' + (totals.filesTotal || 0), sub: '份没被读过' },
      ]
      var allZero = reads === 0 && (totals.readsThisWeek || 0) === 0 && (totals.writesThisWeek || 0) === 0

      var STAGES = ['标杆', '权威', '可靠', '可用', '起步']
      var stageCount = {}
      var byStage = {}
      experts.forEach(function (item) {
        var level = item.stage || '起步'
        stageCount[level] = (stageCount[level] || 0) + 1
        if (!byStage[level]) byStage[level] = []
        byStage[level].push(item)
      })
      var stageTotal = experts.length || 1
      var stageSentence = STAGES.filter(function (stage) { return stageCount[stage] })
        .map(function (stage) { return stage + ' ' + stageCount[stage] })
        .join(' · ')

      var taxoGroups = props.taxonomy && props.taxonomy.length
        ? props.taxonomy
        : TAXONOMY_FALLBACK.map(function (title) { return { id: title, title: title, count: 0, experts: [] } })
      // 类名统一占 5 个字宽：不足 5 字按缺口补字距，让所有类名的右边缘对齐（2026-11-18 用户要求）
      var nameSpacing = function (title) {
        var len = Array.from(String(title || '')).length
        if (len >= 5 || len < 2) return 0
        return Number((((5 - len) * 13) / (len - 1)).toFixed(2))
      }
      var more = moreState[0]
      var setMore = moreState[1]

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 28 } },
        allZero
          ? h('div', { style: styles.bullet }, '还没开始用。第一次叫专家查资料后，这里开始计数。')
          : h(
              'div',
              { style: styles.kpiRow },
              kpis.map(function (item) {
                return h(
                  'div',
                  { key: item.label, style: styles.kpiItem, title: item.label + '：' + item.sub },
                  h('div', { style: styles.kpiValue }, item.value),
                  h('div', { style: styles.kpiLabel }, item.label),
                )
              }),
            ),
        h(
          'div',
          { style: styles.overviewCols },
          h(
            'div',
            { style: styles.overviewCol },
            h(SectionTitle, { title: '资料分类', sub: '八类固定位置：空着的类目先留位，有专家就填进去' }),
            taxoGroups.map(function (group) {
              return h(
                'div',
                { key: group.id, style: styles.taxoRow },
                h('span', { style: Object.assign({}, styles.taxoName, { letterSpacing: nameSpacing(group.title) + 'px' }) }, group.title),
                h(
                  'div',
                  { style: styles.taxoChips },
                  group.count
                    ? group.experts.map(function (item) {
                        return h(
                          'button',
                          {
                            key: item.id,
                            title: stageHintOf(item),
                            style: Object.assign({}, styles.chip, { boxShadow: 'inset 3px 0 0 ' + STAGE_COLOR[item.stage || '起步'] }),
                            onClick: function () { if (props.onOpenExpert) props.onOpenExpert(item.id) },
                          },
                          item.title || item.id,
                        )
                      })
                    : h('span', { style: styles.taxoWait }, '待填'),
                ),
              )
            }),
          ),
          h(
            'div',
            { style: styles.overviewCol },
            h(SectionTitle, { title: '需要补的资料', sub: '模型问了、库里答不上的；补一份就少一条，点一行去补' }),
            (function () {
              var rows = gapRowsOf(experts, props.trace)
              if (rows.length === 0) return h('div', { style: { fontSize: 13, color: MUTED } }, '这里空着，说明库里都答上来了。')
              var shown = rows.slice(0, 5)
              var heavy = shown.filter(function (row) { return row.misses >= 5 })
              var light = shown.filter(function (row) { return row.misses < 5 })
              var cardOf = function (row) {
                return h(
                  'button',
                  {
                    key: row.id,
                    title: '点一下去补这位专家的资料',
                    style: styles.gapCard,
                    onClick: function () { if (props.onOpenGap) props.onOpenGap(row.id); else if (props.onOpenExpert) props.onOpenExpert(row.id) },
                  },
                  h(
                    'span',
                    { style: styles.gapCardMain },
                    h('span', { style: styles.gapTitle }, row.title || row.id),
                    row.examples.length > 0
                      ? h('span', { style: styles.gapWhy }, row.examples.join('；'))
                      : null,
                  ),
                  h(
                    'span',
                    { style: styles.gapCount },
                    h('span', { style: styles.gapNum }, String(row.misses)),
                    h('span', { style: styles.gapUnit }, '次 →'),
                  ),
                )
              }
              var groupOf = function (title, list) {
                if (list.length === 0) return null
                return h(
                  'div',
                  { key: title, style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                  h('div', { style: styles.gapGroupTitle }, title),
                  list.map(cardOf),
                )
              }
              return h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 14 } },
                groupOf('缺得多 · 5 次以上', heavy),
                groupOf('缺一点 · 5 次以内', light),
              )
            })(),
          ),
        ),
        h(
          'button',
          { style: styles.moreToggle, onClick: function () { setMore(!more) } },
          (more ? '▾ 收起' : '▸ 更多：专家成熟度 · 读得最多的资料 · 最近发生'),
        ),
        more
          ? h(
              'div',
              { style: { display: 'flex', flexDirection: 'column', gap: 24 } },
              experts.length > 0
                ? h(
                    'div',
                    { style: styles.plainBlock },
                    h(SectionTitle, { sub: '它现在有多厚：资料齐不齐、有没有人用过；点名字跳到那位专家' }, '专家成熟度'),
                    h('div', { style: { fontSize: 13.5, marginTop: 2 } }, stageTotal + ' 位专家：' + stageSentence),
                    STAGES.map(function (stage) {
                      var group = byStage[stage] || []
                      if (group.length === 0) return null
                      return h(
                        'div',
                        { key: stage, style: styles.stageGroup },
                        h('span', { style: styles.stageGroupName }, stage),
                        h(
                          'div',
                          { style: styles.chipWrap },
                          group.map(function (item) {
                            return h(
                              'button',
                              {
                                key: item.id,
                                title: stageHintOf(item),
                                style: Object.assign({}, styles.chip, { boxShadow: 'inset 3px 0 0 ' + STAGE_COLOR[stage] }),
                                onClick: function () { if (props.onOpenExpert) props.onOpenExpert(item.id) },
                              },
                              item.title || item.id,
                            )
                          }),
                        ),
                      )
                    }),
                  )
                : null,
              h(
                'div',
                { style: styles.plainBlock },
                h(SectionTitle, { sub: '谁在什么时候叫了哪位专家、读了什么' }, '最近发生'),
                recent.length === 0
                  ? h('div', { style: { fontSize: 13, color: MUTED } }, '还没有模型调用记录。')
                  : recent.slice(0, 5).map(function (entry, index) {
                      return h(
                        'div',
                        { key: index, style: styles.recentRow },
                        h('span', { style: styles.time }, timeText(entry.ts)),
                        h('span', { style: { fontSize: 13, lineHeight: '20px', minWidth: 0 } }, traceSentence(entry, sentenceCtx)),
                      )
                    }),
              ),
              h(
                'div',
                { style: styles.plainBlock },
                h(SectionTitle, { sub: '最近 30 天被读次数最多的五份，说明哪些资料真在起作用' }, '读得最多的资料'),
                files.length === 0
                  ? h('div', { style: { fontSize: 13, color: MUTED } }, '还没有资料被读过。')
                  : files.slice(0, 5).map(function (file) {
                      return h(
                        'div',
                        { key: file.path, style: { display: 'flex', gap: 8, fontSize: 13, lineHeight: '28px' } },
                        h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, topFileText(file, experts)),
                        h('span', { style: { color: MUTED, fontVariantNumeric: 'tabular-nums' } }, '被读 ' + file.uses + ' 次'),
                      )
                    }),
              ),
            )
          : null,
      )
    }

    var SCRIPT_KEY = '__script__'
    var ALL_KEY = '__all__'
    var MINE_KEY = '__mine__'

    // 子会话（subagent）归属父会话：分组、筛选都按父会话算，子会话不单列。
    function groupKeyOf(entry) {
      return entry.sessionParentId || entry.session || ''
    }

    // 一个会话用了哪些专家：按会话把记录归拢，专家标题去重计数。
    function useGroups(entries, titles) {
      var order = []
      var byKey = Object.create(null)
      for (var i = 0; i < entries.length; i += 1) {
        var entry = entries[i]
        var key = groupKeyOf(entry)
        if (!byKey[key]) {
          byKey[key] = { key: key, entries: [], experts: [], title: '' }
          order.push(key)
        }
        var group = byKey[key]
        group.entries.push(entry)
        if (!group.title) group.title = entry.sessionTitle || ''
        var expertId = entry.expert || ''
        if (expertId) {
          var found = null
          for (var j = 0; j < group.experts.length; j += 1) if (group.experts[j].id === expertId) found = group.experts[j]
          if (found) found.n += 1
          else group.experts.push({ id: expertId, title: (titles && titles[expertId]) || expertId, n: 1 })
        }
      }
      return order.map(function (key) { return byKey[key] })
    }

    function TraceTab(props) {
      var sentenceCtx = buildSentenceCtx(props.experts)
      var stateSession = useState('')
      var sessionFilter = stateSession[0]
      var setSessionFilter = stateSession[1]
      var stateQuery = useState('')
      var query = stateQuery[0]
      var setQuery = stateQuery[1]
      var all = (props.trace || []).slice().reverse()
      var totalAll = all.length
      var scriptEntries = all.filter(isScriptEntry)
      var modelEntries = all.filter(function (entry) { return !isScriptEntry(entry) })
      var info = sessionInfo(all)
      // 子会话（subagent）在 DSH 里是独立会话，但归属父会话：分组只按父会话，子会话不单列。
      var display = Object.create(null)
      for (var di = 0; di < all.length; di += 1) {
        var raw = all[di]
        var dk = raw.sessionParentId || raw.session
        if (!dk || display[dk]) continue
        if (raw.sessionParentId) display[dk] = raw.sessionParentTitle || '你的对话'
        else if (raw.sessionTitle) display[dk] = raw.sessionTitle
      }
      var titles = Object.create(null)
      var experts = props.experts || []
      for (var ei = 0; ei < experts.length; ei += 1) titles[experts[ei].id] = experts[ei].title || experts[ei].id
      var q = String(query || '').trim().toLowerCase()
      function matches(entry) {
        if (!q) return true
        var hay = [
          traceSentence(entry, sentenceCtx),
          entry.expert || '',
          titles[entry.expert] || '',
          entry.sessionTitle || '',
          entry.sessionParentTitle || '',
          entry.sessionSubagentLabel || '',
          entry.path || '',
          entry.query || '',
        ].join(' ').toLowerCase()
        return hay.indexOf(q) >= 0
      }
      if (q) {
        all = all.filter(matches)
        scriptEntries = scriptEntries.filter(matches)
        modelEntries = modelEntries.filter(matches)
      }
      var mineGroups = useGroups(modelEntries, titles)
      if (totalAll === 0) {
        return h('div', { style: styles.empty }, props.loading ? '正在读取…' : '这里还没有调用记录。模型叫专家查资料时，会按时间倒序列在这里。')
      }
      var entries
      if (sessionFilter === SCRIPT_KEY) entries = scriptEntries
      else if (sessionFilter) entries = modelEntries.filter(function (entry) { return groupKeyOf(entry) === sessionFilter })
      else entries = all
      var modelPart = entries.filter(function (entry) { return !isScriptEntry(entry) })
      var scriptPart = entries.filter(isScriptEntry)
      var groups = useGroups(modelPart, titles)
      var options = [{ key: '', label: '全部记录（' + all.length + ' 条）' }]
      for (var oi = 0; oi < mineGroups.length; oi += 1) {
        options.push({
          key: mineGroups[oi].key,
          label: (display[mineGroups[oi].key] || mineGroups[oi].title || info.title[mineGroups[oi].key] || '未命名会话') + '（' + mineGroups[oi].entries.length + ' 条）',
        })
      }
      if (scriptEntries.length > 0) {
        options.push({ key: SCRIPT_KEY, label: '本机脚本（' + scriptEntries.length + ' 条）' })
      }
      function row(entry, index) {
        return h(
          'div',
          { key: 'r' + index, style: styles.timelineRow },
          h('span', { style: styles.time }, timeText(entry.ts)),
          h(
            'span',
            { style: { flex: 1, minWidth: 0 } },
            h('div', { style: { fontSize: 14 } }, traceSentence(entry, sentenceCtx)),
            h(
              'div',
              { style: { fontSize: 12, color: MUTED, marginTop: 2 } },
              entry.sessionSubagentLabel
                ? '子任务 · ' + entry.sessionSubagentLabel
                : (entry.expert ? (sentenceCtx.names[entry.expert] || entry.expert) : sessionName(entry, info)),
            ),
          ),
        )
      }
      var blocks = []
      for (var gi = 0; gi < groups.length; gi += 1) {
        var group = groups[gi]
        blocks.push(
          h(
            'div',
            { key: 'g' + gi, style: { display: 'flex', flexDirection: 'column', gap: 2 } },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: gi === 0 ? 2 : 10, flexWrap: 'wrap' } },
              h('span', { style: { fontSize: 14, fontWeight: 600 } }, display[group.key] || group.title || info.title[group.key] || '未命名会话'),
              h('span', { style: { fontSize: 12, color: MUTED } }, group.entries.length + ' 条记录'),
            ),
            group.experts.length > 0
              ? h(
                  'div',
                  { style: { fontSize: 12, color: MUTED, marginBottom: 2 } },
                  '用到的专家：' + group.experts.map(function (item) { return item.title + ' ×' + item.n }).join('、'),
                )
              : null,
            group.entries.map(row),
          ),
        )
      }
      if (scriptPart.length > 0) {
        blocks.push(
          h(
            'div',
            { key: 'script', style: { display: 'flex', flexDirection: 'column', gap: 2 } },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 } },
              h('span', { style: { fontSize: 14, fontWeight: 600 } }, '本机脚本'),
              h('span', { style: { fontSize: 12, color: MUTED } }, scriptPart.length + ' 条记录 · 初始化资料库或跑测试时写入'),
            ),
            scriptPart.map(row),
          ),
        )
      }
      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
        h('input', {
          key: 'trace-search',
          type: 'search',
          value: query,
          placeholder: '搜索会话、专家或资料名…',
          onChange: function (event) { setQuery(event.target.value) },
          style: Object.assign({}, styles.input, { marginTop: 2 }),
        }),
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: MUTED } },
          h('span', null, q ? '找到 ' + all.length + ' 条 · 全部 ' + totalAll + ' 条' : '共 ' + totalAll + ' 条'),
          q ? h('button', { style: styles.link, onClick: function () { setQuery('') } }, '清除搜索') : null,
        ),
        all.length === 0
          ? h('div', { style: styles.empty }, '没有找到包含「' + query + '」的记录。')
          : null,
        h(
          'div',
          { style: { display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 } },
          h('span', { style: { fontSize: 12, color: MUTED } }, '只看'),
          h(
            'select',
            {
              key: 'session-select',
              value: sessionFilter,
              onChange: function (event) { setSessionFilter(event.target.value) },
              style: styles.select,
            },
            options.map(function (item) {
              return h('option', { key: 'o' + item.key, value: item.key }, item.label)
            }),
          ),
        ),
        blocks,
      )
    }

    // 向量模型的状态行：一句话说清「装没装 / 下到哪了 / 为什么失败」。
    function modelStateLine(modelState, busy) {
      if (!modelState) return null
      var job = modelState.job || {}
      var style = { fontSize: 12, lineHeight: '20px', color: MUTED }
      if (modelState.installed) {
        var where = modelState.source === 'legacy' ? '插件目录（旧位置）' : '资料目录下 models/'
        return h('div', { style: { fontSize: 12, lineHeight: '20px' } }, '已装好，正在用 ' + where + ' 里的模型。')
      }
      if (busy || job.status === 'picking') return h('div', { style }, '正在找一个能连上的下载源…')
      if (job.status === 'downloading') {
        var total = Number(job.total) || 0
        var got = Number(job.got) || 0
        var percent = total > 0 ? Math.min(100, Math.round((got / total) * 100)) : 0
        return h('div', { style }, '正在下载（' + (job.source || '未知源') + '）：' + percent + '%')
      }
      if (job.status === 'failed') {
        return h('div', { style: { fontSize: 12, lineHeight: '20px', color: '#b45309' } }, '下载没成：' + (job.error || '未知原因') + '；现在用的是关键词检索。')
      }
      return h('div', { style }, '还没装：现在用关键词检索，装好之后换成向量检索，找资料更准。')
    }

    function SettingsTab(props) {
      function pill(active, off) {
        return {
          padding: '6px 12px',
          borderRadius: 999,
          cursor: off ? 'not-allowed' : 'pointer',
          font: 'inherit',
          fontSize: 13,
          lineHeight: '20px',
          border: '1px solid ' + (active ? '#1f6feb' : BORDER),
          background: active ? '#eef4ff' : '#fff',
          color: active ? '#1f6feb' : STRONG,
          fontWeight: active ? 600 : 400,
          opacity: off ? 0.55 : 1,
        }
      }
      function seg(list, current, onPick, disabled) {
        return h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', gap: 8 } },
          (list || []).map(function (item) {
            var active = current === item.id
            var off = disabled || item.disabled
            return h(
              'button',
              {
                key: item.id,
                type: 'button',
                disabled: off,
                title: item.disabled ? t('暂停使用') : undefined,
                onClick: function () { if (!off) onPick(item.id) },
                style: pill(active, off),
              },
              item.label,
            )
          }),
        )
      }
      function hintOf(list, current) {
        var hit = (list || []).filter(function (x) { return x.id === current })[0]
        if (!hit || !hit.hint) return null
        return h('div', { style: { marginTop: 6, fontSize: 12, lineHeight: '18px', color: MUTED } }, hit.hint)
      }
      function row(label, list, current, onPick) {
        return h(
          'div',
          { style: { marginTop: 10 } },
          h('div', { style: { marginBottom: 8, fontSize: 13, fontWeight: 500 } }, label),
          seg(list, current, onPick, props.busy),
          hintOf(list, current),
        )
      }
      function pair(a, b) {
        return h(
          'div',
          { style: { display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' } },
          h('div', { style: { flex: '1 1 320px', minWidth: 0 } }, a),
          h('div', { style: { flex: '1 1 320px', minWidth: 0 } }, b),
        )
      }
      function block(title, sub, children, card) {
        return h(
          'div',
          {
            style: Object.assign(
              { marginBottom: 20 },
              card ? { border: '1px solid ' + BORDER, borderRadius: 8, padding: 16 } : {},
            ),
          },
          h('h3', { style: { margin: '0 0 4px', fontSize: 17, fontWeight: 600 } }, title),
          h('p', { style: { margin: '0 0 10px', fontSize: 12, lineHeight: '18px', color: MUTED } }, sub),
          children,
        )
      }
      var whiteCount = (props.fillExperts || []).length
      var advancedLabel =
        t('高级：步数与白名单（') +
        (props.fillSteps || 1) +
        t(' 步，') +
        (whiteCount ? whiteCount + t(' 位专家') : t('未设白名单')) +
        '）'

      return h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', maxWidth: 800 } },
        block(
          '什么时候查资料',
          '决定它是主动翻库，还是等你点名——两种都不改动你的资料，只是查不查。',
          pair(
            row('模型什么时候来查', props.modes, props.mode, props.onMode),
            row('补资料 / 做调研时怎么查', props.options, props.research, props.onResearch),
          ),
        ),
        block(
          '查完怎么跟你说',
          '决定它中途停不停、以及库答不上来时要不要在回复末尾提一句。',
          pair(
            row('它查资料的时候，什么时候停下来', props.reportModes || [], props.reportMode, props.onReportMode),
            row('资料缺口提醒的阈值', props.gapOptions || [], props.gap, props.onGap),
          ),
        ),
        block(
          '补资料要不要先问你',
          '补资料会花额度、会往库里写文件，默认每次都要你点头。',
          h(
            'div',
            null,
            row('查到库里没有时', props.fillModes || [], props.fillMode, props.onFillMode),
            props.fillMode === 'ask'
              ? null
              : h(
                'details',
                { style: { marginTop: 12 } },
                h(
                  'summary',
                  { style: { cursor: 'pointer', fontSize: 13, color: STRONG, padding: '4px 0' } },
                  advancedLabel,
                ),
                h(
                  'div',
                  { style: { marginTop: 10, paddingTop: 12, borderTop: '1px solid ' + BORDER } },
                  row('一次最多跑几步', props.fillStepOptions || [], props.fillSteps, props.onFillSteps),
                  props.fillMode === 'experts'
                    ? h(
                      'div',
                      { style: { marginTop: 14 } },
                      h('div', { style: { marginBottom: 8, fontSize: 13, fontWeight: 500 } }, '放行哪些专家'),
                      h(
                        'div',
                        { style: { display: 'flex', flexWrap: 'wrap', gap: 6 } },
                        (props.experts || []).map(function (item) {
                          var on = (props.fillExperts || []).indexOf(item.id) >= 0
                          return h(
                            'button',
                            {
                              key: item.id,
                              type: 'button',
                              disabled: props.busy,
                              onClick: function () { props.onToggleFillExpert(item.id) },
                              style: {
                                fontSize: 12,
                                padding: '5px 10px',
                                borderRadius: 999,
                                cursor: 'pointer',
                                border: '1px solid ' + (on ? '#1f6feb' : BORDER),
                                background: on ? '#eef4ff' : '#fff',
                                color: on ? '#1f6feb' : STRONG,
                              },
                            },
                            item.title || item.id,
                          )
                        }),
                      ),
                    )
                    : null,
                ),
              ),
          ),
        ),
        block(
          '资料目录',
          '专家库的所有资料都存在这里；默认在 DSH 数据目录下，可以换到任何盘。',
          h(
            'div',
            null,
            props.dataDir
              ? h(
                'div',
                { style: { marginBottom: 10, fontSize: 12, lineHeight: '20px', color: MUTED } },
                h('div', null, t('现在用的：') + (props.dataDir.active || '')),
                h('div', null, t('默认位置：') + (props.dataDir.defaultDir || '')),
                props.dataDir.source === 'env'
                  ? h('div', null, t('由环境变量 DSH_EXPERT_ROOT 指定，面板里改不了。'))
                  : null,
                props.dataDir.pending
                  ? h('div', { style: { color: '#b45309' } }, t('已改，重启 DSH 后生效。'))
                  : null,
              )
              : h('div', { style: { marginBottom: 10, fontSize: 12, color: MUTED } }, t('读取中…')),
            h(
              'label',
              { style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 10, fontSize: 12, color: MUTED } },
              h('input', {
                type: 'checkbox',
                checked: props.adoptWorkspace !== false,
                disabled: props.busy,
                onChange: function (event) { props.onAdoptWorkspace(event.target.checked) },
              }),
              t('启动时把资料目录放进左侧工作区'),
            ),
            props.adoptWorkspace === false
              ? h('div', { style: { marginBottom: 10, fontSize: 12, lineHeight: '18px', color: MUTED } }, t('关掉后不再自动加；已经在左侧的那一条不会自己消失，可以在侧栏里手动删。'))
              : null,
            h(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' } },
              h('input', {
                type: 'text',
                value: props.dataDirInput || '',
                placeholder: 'D:\\DSH数据\\experts',
                disabled: props.busy || props.dataDirBusy || (props.dataDir && props.dataDir.source === 'env'),
                onChange: function (event) { props.onDataDirInput(event.target.value) },
                style: {
                  flex: '1 1 280px',
                  minWidth: 0,
                  height: 32,
                  padding: '0 10px',
                  font: 'inherit',
                  fontSize: 13,
                  border: '1px solid ' + BORDER,
                  borderRadius: 6,
                },
              }),
              h(
                'button',
                {
                  type: 'button',
                  disabled: props.busy || props.dataDirBusy || (props.dataDir && props.dataDir.source === 'env'),
                  onClick: props.onApplyDataDir,
                  style: {
                    height: 32,
                    padding: '0 14px',
                    borderRadius: 6,
                    border: '1px solid #1f6feb',
                    background: '#1f6feb',
                    color: '#fff',
                    font: 'inherit',
                    fontSize: 13,
                    cursor: 'pointer',
                  },
                },
                t('换到这里'),
              ),
              h(
                'button',
                {
                  type: 'button',
                  disabled: props.busy || props.dataDirBusy || !(props.dataDir && props.dataDir.overridden),
                  onClick: props.onResetDataDir,
                  style: {
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid ' + BORDER,
                    background: '#fff',
                    color: STRONG,
                    font: 'inherit',
                    fontSize: 13,
                    cursor: 'pointer',
                  },
                },
                t('恢复默认'),
              ),
            ),
            props.dataDir && Array.isArray(props.dataDir.candidates) && props.dataDir.candidates.length
              ? h(
                'div',
                { style: { marginTop: 14 } },
                h('div', { style: { fontSize: 12, color: MUTED, marginBottom: 6 } }, t('这台机器上已有的库（点一下就用，不复制不删）')),
                h(
                  'div',
                  { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                  props.dataDir.candidates.map(function (item) {
                    return h(
                      'div',
                      { key: item.dir, style: { display: 'flex', gap: 10, alignItems: 'center', fontSize: 12, color: STRONG } },
                      h('span', { style: { flex: '1 1 auto', minWidth: 0, wordBreak: 'break-all' } }, item.dir),
                      h('span', { style: { color: MUTED, whiteSpace: 'nowrap' } }, item.experts + t(' 位专家')),
                      item.systemDrive ? h('span', { style: { color: '#b45309', whiteSpace: 'nowrap' } }, t('在系统盘')) : null,
                      h(
                        'button',
                        {
                          type: 'button',
                          disabled: props.busy || props.dataDirBusy,
                          onClick: function () { props.onUseCandidate(item.dir) },
                          style: {
                            height: 28,
                            padding: '0 10px',
                            borderRadius: 6,
                            border: '1px solid ' + BORDER,
                            background: '#fff',
                            color: STRONG,
                            font: 'inherit',
                            fontSize: 12,
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                          },
                        },
                        t('用这个'),
                      ),
                    )
                  }),
                ),
              )
              : null,
            h(
              'div',
              { style: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' } },
              h(
                'button',
                {
                  type: 'button',
                  disabled: props.busy || props.dataDirBusy || !(props.dataDir && props.dataDir.active),
                  onClick: props.onMigrateDataDir,
                  style: {
                    height: 32,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: '1px solid ' + BORDER,
                    background: '#fff',
                    color: STRONG,
                    font: 'inherit',
                    fontSize: 13,
                    cursor: 'pointer',
                  },
                },
                t('把现有资料迁到这里'),
              ),
              h(
                'label',
                { style: { display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: MUTED } },
                h('input', {
                  type: 'checkbox',
                  checked: Boolean(props.dataDirDeleteOld),
                  disabled: props.busy || props.dataDirBusy,
                  onChange: function (event) { props.onDataDirDeleteOld(event.target.checked) },
                }),
                t('迁完删掉旧目录'),
              ),
            ),
            h(
              'label',
              { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 12, color: MUTED } },
              h('input', {
                type: 'checkbox',
                checked: Boolean(props.dataDirCopy),
                disabled: props.busy || props.dataDirBusy,
                onChange: function (event) { props.onDataDirCopy(event.target.checked) },
              }),
              t('把现有资料复制到新位置（旧目录不删）'),
            ),
            props.dataDirNote
              ? h('div', { style: { marginTop: 8, fontSize: 12, lineHeight: '18px', color: '#b45309' } }, props.dataDirNote)
              : null,
          ),
        ),
        block(
          '向量模型',
          '检索靠这个本地模型把资料变成向量；没装时先用关键词凑合，装了会更准。',
          h(
            'div',
            null,
            modelStateLine(props.modelState, props.modelBusy)
              ? modelStateLine(props.modelState, props.modelBusy)
              : h('div', { style: { fontSize: 12, color: MUTED } }, '读取中…'),
            h(
              'div',
              { style: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginTop: 10 } },
            h(
              'button',
              {
                style: styles.btn,
                disabled: props.busy || props.modelBusy || Boolean(props.modelState && props.modelState.installed),
                onClick: function () { props.onModelDownload() },
              },
              props.modelState && props.modelState.installed ? '已装好' : '下载向量模型',
            ),
              h('span', { style: { fontSize: 12, color: MUTED } }, '下载顺序：先试境外源，再试国内镜像（够快才用），最后用备份地址。'),
            ),
            props.modelState && props.modelState.dir
              ? h('div', { style: { marginTop: 8, fontSize: 12, lineHeight: '18px', color: MUTED } }, '存放位置：' + props.modelState.dir)
              : null,
          ),
        ),
        block(
          '界面与提醒',
          '只换界面文字与提醒方式；专家名和资料名保持库里原样。',
          row('界面语言', props.langs || [], props.lang, props.onLang),
        ),
        h('div', { style: { fontSize: 12, color: MUTED } }, '设置跟着专家库走，换台机器不用重设。'),
      )
    }

    // 面板被卸载再打开时，先用上一次的数据渲染，避免先闪一句「这里还没有…」。
    var SNAP = { experts: [], taxonomy: [], trace: [], sessionLog: [], modelState: null, stats: null, audit: null, updatedAt: 0, loaded: false }

    function Panel() {
      var stateExperts = useState(SNAP.experts)
      var experts = stateExperts[0]
      var setExperts = stateExperts[1]
      var stateOpen = useState(null)
      var open = stateOpen[0]
      var setOpen = stateOpen[1]
      var stateTrace = useState(SNAP.trace)
      var trace = stateTrace[0]
      var setTrace = stateTrace[1]
      var stateFiles = useState([])
      var files = stateFiles[0]
      var setFiles = stateFiles[1]
      var stateContent = useState(null)
      var content = stateContent[0]
      var setContent = stateContent[1]
      var stateStats = useState(SNAP.stats)
      var stats = stateStats[0]
      var setStats = stateStats[1]
      var stateAudit = useState(SNAP.audit)
      var audit = stateAudit[0]
      var setAudit = stateAudit[1]
      var stateTab = useState('overview')
      var tab = stateTab[0]
      var setTab = stateTab[1]
      // 专家页两级：先选大类，再看这一类的专家卡。空串＝还没进任何大类。
      var stateCat = useState('')
      var cat = stateCat[0]
      var setCat = stateCat[1]
      var stateError = useState('')
      var error = stateError[0]
      var setError = stateError[1]
      var stateMode = useState('on-request')
      var mode = stateMode[0]
      var setMode = stateMode[1]
      var stateResearch = useState('serial')
      var research = stateResearch[0]
      var setResearch = stateResearch[1]
      var stateLang = useState('auto')
      var lang = stateLang[0]
      var setLang = stateLang[1]
      var stateReportMode = useState('turn')
      var reportMode = stateReportMode[0]
      var setReportMode = stateReportMode[1]
      var stateFillMode = useState('ask')
      var fillMode = stateFillMode[0]
      var setFillMode = stateFillMode[1]
      var stateFillSteps = useState(2)
      var fillSteps = stateFillSteps[0]
      var setFillSteps = stateFillSteps[1]
      var stateFillExperts = useState([])
      var fillExperts = stateFillExperts[0]
      var setFillExperts = stateFillExperts[1]
      var stateGap = useState(0.2)
      var gap = stateGap[0]
      var setGap = stateGap[1]
      var stateModeBusy = useState(false)
      var modeBusy = stateModeBusy[0]
      var setModeBusy = stateModeBusy[1]
      var stateDataDir = useState(null)
      var dataDir = stateDataDir[0]
      var setDataDir = stateDataDir[1]
      var stateDataDirInput = useState('')
      var dataDirInput = stateDataDirInput[0]
      var setDataDirInput = stateDataDirInput[1]
      var stateAdoptWorkspace = useState(true)
      var adoptWorkspace = stateAdoptWorkspace[0]
      var setAdoptWorkspace = stateAdoptWorkspace[1]
      var stateDataDirCopy = useState(true)
      var dataDirCopy = stateDataDirCopy[0]
      var setDataDirCopy = stateDataDirCopy[1]
      var stateDataDirBusy = useState(false)
      var dataDirBusy = stateDataDirBusy[0]
      var setDataDirBusy = stateDataDirBusy[1]
      var stateDataDirNote = useState('')
      var dataDirNote = stateDataDirNote[0]
      var setDataDirNote = stateDataDirNote[1]
      var stateDataDirDeleteOld = useState(false)
      var dataDirDeleteOld = stateDataDirDeleteOld[0]
      var setDataDirDeleteOld = stateDataDirDeleteOld[1]

      // 从概览点名字：切到专家页、展开、滚到那张卡；点的是缺口就滚到缺口清单并闪一下。
      // 高亮动画：淡入 0.2s → 停 1.1s → 淡出 0.2s，共 1.5s。
      function flashEl(el, kind) {
        if (!el || typeof el.animate !== 'function') return
        var frames =
          kind === 'gap'
            ? [
              { background: 'rgba(255,247,237,0)' },
              { background: '#fff7ed', offset: 0.2 / 1.5 },
              { background: '#fff7ed', offset: 1.3 / 1.5 },
              { background: 'rgba(255,247,237,0)' },
            ]
            : [
              { boxShadow: '0 0 0 0 rgba(31,111,235,0)' },
              { boxShadow: '0 0 0 3px rgba(31,111,235,.45)', offset: 0.2 / 1.5 },
              { boxShadow: '0 0 0 3px rgba(31,111,235,.45)', offset: 1.3 / 1.5 },
              { boxShadow: '0 0 0 0 rgba(31,111,235,0)' },
            ]
        el.animate(frames, { duration: 1500, easing: 'ease' })
      }

      function categoryTitleOf(id) {
        var hit = (taxonomy || []).filter(function (group) {
          return (group.experts || []).some(function (item) { return item.id === id })
        })[0]
        if (hit) return hit.title
        var row = (experts || []).filter(function (item) { return item.id === id })[0]
        return (row && row.level1) || '专业技术'
      }

      function jumpTo(id, gapMode) {
        setTab('experts')
        setCat(categoryTitleOf(id))
        setOpen(id)
        setTimeout(function () {
          // 一律滚到专家卡片顶部：从缺口进来时卡片头也要露出来，
          // 缺口那块留在原位闪一下，不把它顶到窗口最上面。
          var target = document.getElementById('expert-card-' + id)
          if (target && target.scrollIntoView) target.scrollIntoView({ block: 'start' })
          flashEl(
            document.getElementById(gapMode ? 'expert-gap-' + id : 'expert-card-' + id),
            gapMode ? 'gap' : 'card',
          )
        }, 60)
      }

      var MODES = [
        { id: 'auto', label: '自动识别', hint: '模型自己判断相关就查' },
        { id: 'on-request', label: '点名才查', hint: '只有你说「调用 / 问问 / 查阅某专家」才查' },
        { id: 'off', label: '不自动查', hint: '库还在，只是模型不会自己来翻；建库、调研照常' },
      ]

      var RESEARCH = [
        { id: 'parallel', label: '同时查', hint: '派子智能体同时查（会开临时会话，不记进使用记录）；快，但更费额度' },
        { id: 'serial', label: '一条条查', hint: '在当前对话里一条条查，不开任何新会话；慢一点，方向更准' },
        { id: 'workspace', label: '单独开一个对话', hint: '暂停使用：等整体做完再开放（会复用同一个会话，不逐条新建）', disabled: true },
      ]

      var GAP = [
        { id: 0.1, label: '10%', hint: '有一点缺口就提醒，最勤' },
        { id: 0.2, label: '20%', hint: '默认：五分之一以上答不上来才提醒' },
        { id: 0.3, label: '30%', hint: '缺口比较明显才提醒' },
        { id: 0.5, label: '50%', hint: '一半答不上来才提醒，最安静' },
      ]

      var REPORTS = [
        { id: 'turn', label: '只在需要转向时停', hint: '推荐：平时不打扰，只在方向可能要改时停下来问你' },
        { id: 'step', label: '每查完一份就停', hint: '最稳：每份都汇报一句，等你点头再继续；会比较打断你' },
        { id: 'auto', label: '全部查完再汇报', hint: '最省心：中途不问，跑完一次性说结果' },
      ]

      var FILLS = [
        { id: 'ask', label: '每次问我', hint: '默认：查到库里没有，先停下问你要不要补' },
        { id: 'scoped', label: '提前授权，按步数跑', hint: '最多跑 N 步就停，跑完汇报；仍然要花额度' },
        { id: 'experts', label: '只对指定专家放行', hint: '白名单里的专家自己补，其余仍然每次问' },
      ]

      var FILL_STEPS_OPTIONS = [
        { id: 1, label: '1 步', hint: '最省' },
        { id: 2, label: '2 步', hint: '默认' },
        { id: 3, label: '3 步', hint: '' },
        { id: 5, label: '5 步', hint: '较多' },
      ]

      var LANGS = [
        { id: 'auto', label: '跟随系统', hint: '中文系统用中文，其余用 English' },
        { id: 'zh', label: '中文', hint: '界面用中文' },
        { id: 'en', label: 'English', hint: 'Panel in English' },
      ]

      var saveSettings = useCallback(function (patch) {
        setModeBusy(true)
        api('/expert-role/api/settings', { method: 'POST', body: patch })
          .then(function (data) {
            setMode(data.mode || mode)
            setResearch(data.research || research)
            setReportMode(data.reportMode || 'turn')
            setLang(data.lang || lang)
            if (typeof data.gap === 'number') setGap(data.gap)
            if (data.fillMode) setFillMode(data.fillMode)
            if (typeof data.fillSteps === 'number') setFillSteps(data.fillSteps)
            if (Array.isArray(data.fillExperts)) setFillExperts(data.fillExperts)
            setAdoptWorkspace(data.adoptWorkspace !== false)
            LANG = resolveLang(data.lang || lang, window.navigator && window.navigator.language)
            setError('')
          })
          .catch(function (err) { setError(String(err.message || err)) })
          .then(function () { setModeBusy(false) })
      }, [mode, research])

      var loadDataDir = useCallback(function () {
        api('/expert-role/api/data-dir')
          .then(function (data) {
            setDataDir(data)
            if (!dataDirInput) setDataDirInput(data.active || '')
          })
          .catch(function () {})
      }, [])

      var migrateDataDir = useCallback(function () {
        var target = String(dataDirInput || '').trim()
        if (!target) {
          setDataDirNote(t('先填一个完整路径'))
          return
        }
        setDataDirBusy(true)
        setDataDirNote('')
        api('/expert-role/api/data-dir', { method: 'POST', body: { directory: target, migrate: true, deleteOld: Boolean(dataDirDeleteOld) } })
          .then(function (data) {
            setDataDir(data)
            setDataDirNote(
              t('已迁过去 ') + (data.moved || 0) + t(' 位专家，重启 DSH 后生效。') + (data.deleted ? t('旧目录已删。') : t('旧目录保留。')),
            )
          })
          .catch(function (err) { setDataDirNote(String(err.message || err)) })
          .then(function () { setDataDirBusy(false) })
      }, [dataDirInput, dataDirDeleteOld])

      var useCandidate = useCallback(function (dir) {
        setDataDirInput(String(dir || ''))
        setDataDirBusy(true)
        setDataDirNote('')
        api('/expert-role/api/data-dir', { method: 'POST', body: { directory: String(dir || ''), copy: false } })
          .then(function (data) {
            setDataDir(data)
            setDataDirNote(t('已指向这个库，重启 DSH 后生效。'))
          })
          .catch(function (err) { setDataDirNote(String(err.message || err)) })
          .then(function () { setDataDirBusy(false) })
      }, [])

      var applyDataDir = useCallback(function () {
        var target = String(dataDirInput || '').trim()
        if (!target) {
          setDataDirNote(t('先填一个完整路径'))
          return
        }
        setDataDirBusy(true)
        setDataDirNote('')
        api('/expert-role/api/data-dir', { method: 'POST', body: { directory: target, copy: Boolean(dataDirCopy) } })
          .then(function (data) {
            setDataDir(data)
            setDataDirNote(
              data.copied
                ? t('已记住新位置，并复制了 ') + data.copied + t(' 项。重启 DSH 后生效。')
                : t('已记住新位置，重启 DSH 后生效。'),
            )
          })
          .catch(function (err) { setDataDirNote(String(err.message || err)) })
          .then(function () { setDataDirBusy(false) })
      }, [dataDirInput, dataDirCopy])

      var resetDataDir = useCallback(function () {
        setDataDirBusy(true)
        setDataDirNote('')
        api('/expert-role/api/data-dir/reset', { method: 'POST', body: {} })
          .then(function (data) {
            setDataDir(data)
            setDataDirInput(data.defaultDir || '')
            setDataDirNote(t('已恢复默认位置，重启 DSH 后生效；旧位置的文件不会删。'))
          })
          .catch(function (err) { setDataDirNote(String(err.message || err)) })
          .then(function () { setDataDirBusy(false) })
      }, [])

      var changeAdoptWorkspace = useCallback(function (next) {
        var value = next !== false
        setAdoptWorkspace(value)
        saveSettings({ adoptWorkspace: value }).catch(function (err) { setError(String(err && err.message ? err.message : err)) })
      }, [])

      var changeGap = useCallback(function (next) {
        var value = Number(next)
        if (!Number.isFinite(value) || value === gap) return
        saveSettings({ gap: value })
      }, [gap, saveSettings])

      var changeMode = useCallback(function (next) {
        if (!next || next === mode) return
        saveSettings({ mode: next })
      }, [mode, saveSettings])

      var changeResearch = useCallback(function (next) {
        if (!next || next === research) return
        saveSettings({ research: next })
      }, [research, saveSettings])

      var changeLang = useCallback(function (next) {
        if (!next || next === lang) return
        saveSettings({ lang: next })
      }, [lang, saveSettings])

      var changeReportMode = useCallback(function (next) {
        setReportMode(next)
        saveSettings({ reportMode: next }).catch(function (err) { setError(String(err && err.message ? err.message : err)) })
      }, [])

      var changeFillMode = useCallback(function (next) {
        if (!next || next === fillMode) return
        saveSettings({ fillMode: next })
      }, [fillMode, saveSettings])

      var changeFillSteps = useCallback(function (next) {
        var value = Number(next)
        if (!Number.isFinite(value) || value === fillSteps) return
        saveSettings({ fillSteps: value })
      }, [fillSteps, saveSettings])

      var toggleFillExpert = useCallback(function (id) {
        var list = Array.isArray(fillExperts) ? fillExperts.slice() : []
        var at = list.indexOf(id)
        if (at >= 0) list.splice(at, 1)
        else list.push(id)
        saveSettings({ fillExperts: list })
      }, [fillExperts, saveSettings])

      var stateRefreshing = useState(false)
      var refreshing = stateRefreshing[0]
      var setRefreshing = stateRefreshing[1]
      var stateFade = useState(1)
      var fade = stateFade[0]
      var setFade = stateFade[1]
      var stateUpdatedAt = useState(SNAP.updatedAt)
      var stateLoading = useState(!SNAP.loaded)
      var loading = stateLoading[0]
      var setLoading = stateLoading[1]
      var updatedAt = stateUpdatedAt[0]
      var setUpdatedAt = stateUpdatedAt[1]
      var stateTaxonomy = useState(SNAP.taxonomy)
      var taxonomy = stateTaxonomy[0]
      var setTaxonomy = stateTaxonomy[1]
      // 大类会话的每一轮结果：插件收，人只在想看时翻。
      var stateGapRuns = useState(SNAP.gapRuns || {})
      var gapRuns = stateGapRuns[0]
      var setGapRuns = stateGapRuns[1]
      var stateSessionLog = useState(SNAP.sessionLog)
      var sessionLog = stateSessionLog[0]
      var setSessionLog = stateSessionLog[1]
      var stateModelState = useState(SNAP.modelState || null)
      var modelState = stateModelState[0]
      var setModelState = stateModelState[1]
      var stateModelBusy = useState(false)
      var modelBusy = stateModelBusy[0]
      var setModelBusy = stateModelBusy[1]

      var downloadModel = useCallback(function () {
        setModelBusy(true)
        api('/expert-role/api/model-download', { method: 'POST' })
          .then(function () {
            return api('/expert-role/api/model-state')
          })
          .then(function (data) {
            SNAP.modelState = data
            setModelState(data)
            setModelBusy(false)
            if (data && data.installed) reload(true)
          })
          .catch(function (error) {
            setModelBusy(false)
            setModelState(function (prev) {
              return Object.assign({}, prev || {}, { job: { status: 'failed', error: String((error && error.message) || error) } })
            })
          })
      }, [])

      var reload = useCallback(function (manual) {
        if (manual) setRefreshing(true)
        var jobs = [
          api('/expert-role/api/experts').then(function (data) {
            SNAP.experts = data.experts || []
            SNAP.taxonomy = data.taxonomy || []
            setExperts(SNAP.experts)
            setTaxonomy(SNAP.taxonomy)
            setError('')
          }).catch(function (err) { setError(String(err.message || err)) }),
          api('/expert-role/api/trace?limit=200').then(function (data) { SNAP.trace = data.entries || []; setTrace(SNAP.trace) }).catch(function () {}),
          api('/expert-role/api/session-log?limit=200').then(function (data) { SNAP.sessionLog = data.entries || []; setSessionLog(SNAP.sessionLog) }).catch(function () {}),
          api('/expert-role/api/model-state').then(function (data) { SNAP.modelState = data; setModelState(data) }).catch(function () {}),
          api('/expert-role/api/gap-research').then(function (data) {
            var map = {}
            ;(data.runs || []).forEach(function (run) {
              if (!run || !run.sessionId || !run.key) return
              map[String(run.expert) + '\u0000' + String(run.key)] = run
            })
            SNAP.gapRuns = map
            setGapRuns(map)
          }).catch(function () {}),
          api('/expert-role/api/stats?days=30').then(function (data) { SNAP.stats = data; setStats(data) }).catch(function () {}),
          api('/expert-role/api/retrieval?limit=200').then(function (data) { SNAP.audit = data; setAudit(data) }).catch(function () {}),
          api('/expert-role/api/data-dir').then(function (data) {
            setDataDir(data)
            if (data && data.active) setDataDirInput(data.active)
          }).catch(function () {}),
          api('/expert-role/api/settings').then(function (data) {
            setMode(data.mode || 'on-request')
            setResearch(data.research || 'serial')
            setLang(data.lang || 'auto')
            if (typeof data.gap === 'number') setGap(data.gap)
            if (data.fillMode) setFillMode(data.fillMode)
            if (typeof data.fillSteps === 'number') setFillSteps(data.fillSteps)
            if (Array.isArray(data.fillExperts)) setFillExperts(data.fillExperts)
            LANG = resolveLang(data.lang || 'auto', window.navigator && window.navigator.language)
          }).catch(function () {}),
        ]
        Promise.all(jobs).then(function () {
          SNAP.loaded = true
          SNAP.updatedAt = Date.now()
          setUpdatedAt(SNAP.updatedAt)
          setLoading(false)
          if (!manual) return
          // 某个应用的做法：点击立刻响应，数据真正回来后再淡入一次（只改透明度）
          setRefreshing(false)
          setFade(0.35)
          setTimeout(function () { setFade(1) }, 20)
        })
      }, [])

      // 有派发在跑时每秒重渲染一次，好让「已跑 1 分 47 秒」动起来。
      var stateClock = useState(0)
      var tick = stateClock[1]
      var anyRunning = experts.some(function (item) { return item.runningSince })
      useEffect(function () {
        if (!anyRunning) return undefined
        var timer = setInterval(function () { tick(function (n) { return n + 1 }) }, 1000)
        return function () { clearInterval(timer) }
      }, [anyRunning])

      useEffect(function () {
        reload(false)
        var timer = setInterval(function () { reload(false) }, 5000)
        return function () { clearInterval(timer) }
      }, [reload])

      useEffect(function () {
        if (!open) { setFiles([]); setContent(null); return }
        api('/expert-role/api/files?expert=' + encodeURIComponent(open))
          .then(function (data) { setFiles(data.files || []) })
          .catch(function (err) { setError(String(err.message || err)) })
      }, [open])

      var onRefresh = useCallback(function () { reload(true) }, [reload])

      // 缺口主题的三个处置：回收 / 去查 / 不用补。再点一次同一个 = 撤销。
      var decideGap = useCallback(function (expertId, key, action) {
        // 「去查」走真调研接口：后端开会话、跑完写回资料库；其它处置只记决定。
        api(action === 'research' ? '/expert-role/api/gap-research' : '/expert-role/api/gap-decision', {
          method: 'POST',
          body: action === 'research'
            ? { expert: expertId, key: key }
            : { expert: expertId, key: key, action: action },
        })
          .then(function () { return reload(true) })
          .catch(function (error) {
            if (typeof setError === 'function') setError('处置没保存：' + (error && error.message ? error.message : String(error)))
          })
      }, [reload])

      var onOpen = useCallback(function (path) {
        api('/expert-role/api/file?path=' + encodeURIComponent(path))
          .then(function (data) { setContent(data) })
          .catch(function (err) { setError(String(err.message || err)) })
      }, [])

      var expert = experts.find(function (item) { return item.id === open }) || null

      return h(
        'div',
        { style: styles.root },
        h(
          'div',
          { style: styles.head },
          h(
            'div',
            { style: styles.headText },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'baseline', gap: 10 } },
              h('h2', { style: styles.title }, '专家库'),
            ),
            h('p', { style: styles.lead }, '各领域的资料按专家放在这里。什么时候让模型来查，去「设置」里选。'),
          ),
        ),
        h(
          'div',
          { style: styles.tabs },
          h(
            'div',
            { style: { display: 'flex', gap: 16 } },
            h('button', { style: Object.assign({}, styles.tab, tab === 'overview' ? styles.tabActive : {}), onClick: function () { setTab('overview') } }, '概况'),
            h(
              'button',
              { style: Object.assign({}, styles.tab, tab === 'experts' ? styles.tabActive : {}), onClick: function () { setTab('experts') } },
              experts.length > 0 ? '专家 ' + experts.length : '专家',
            ),
            h('button', { style: Object.assign({}, styles.tab, tab === 'trace' ? styles.tabActive : {}), onClick: function () { setTab('trace') } }, '调用记录'),
            h('button', { style: Object.assign({}, styles.tab, tab === 'sessionLog' ? styles.tabActive : {}), onClick: function () { setTab('sessionLog') } }, '会话动态'),
            h('button', { style: Object.assign({}, styles.tab, tab === 'audit' ? styles.tabActive : {}), onClick: function () { setTab('audit') } }, '自检'),
            h('button', { style: Object.assign({}, styles.tab, tab === 'settings' ? styles.tabActive : {}), onClick: function () { setTab('settings') } }, '设置'),
          ),
          updatedAt ? h('span', { style: styles.stamp }, '更新于 ' + timeText(new Date(updatedAt).toISOString())) : null,
          h(
            'button',
            {
              style: Object.assign({}, styles.pill, refreshing ? { opacity: 0.6, cursor: 'default' } : {}),
              title: '重新读取专家库',
              disabled: refreshing,
              onClick: onRefresh,
            },
            refreshing ? '刷新中' : '刷新',
          ),
        ),
        error
          ? h(
              'div',
              { style: styles.error },
              h('span', { style: { flex: 1 } }, '读取失败，请点「重试」。'),
              h('button', { style: Object.assign({}, styles.link, { fontWeight: 600 }), onClick: onRefresh }, '重试'),
              h('details', { style: { marginTop: 4, fontSize: 12, opacity: 0.85, width: '100%' } }, h('summary', { style: styles.summary }, '技术细节'), String(error)),
            )
          : null,
        h(
          'div',
          { style: Object.assign({}, styles.body, { opacity: fade, transition: 'opacity 100ms ease-out' }) },
          tab === 'settings'
            ? h(SettingsTab, {
                modes: MODES,
                options: RESEARCH,
                mode: mode,
                research: research,
                lang: lang,
                langs: LANGS,
                gap: gap,
                gapOptions: GAP,
                reportMode: reportMode,
                reportModes: REPORTS,
                onReportMode: changeReportMode,
                fillMode: fillMode,
                fillModes: FILLS,
                fillSteps: fillSteps,
                fillStepOptions: FILL_STEPS_OPTIONS,
                fillExperts: fillExperts,
                experts: experts,
                onFillMode: changeFillMode,
                onFillSteps: changeFillSteps,
                onToggleFillExpert: toggleFillExpert,
                busy: modeBusy,
                dataDir: dataDir,
                dataDirInput: dataDirInput,
                onDataDirInput: setDataDirInput,
                dataDirCopy: dataDirCopy,
                onDataDirCopy: setDataDirCopy,
                adoptWorkspace: adoptWorkspace,
                onAdoptWorkspace: changeAdoptWorkspace,
                dataDirBusy: dataDirBusy,
                dataDirNote: dataDirNote,
                dataDirDeleteOld: dataDirDeleteOld,
                onDataDirDeleteOld: setDataDirDeleteOld,
                modelState: modelState,
                modelBusy: modelBusy,
                onModelDownload: downloadModel,
                onApplyDataDir: applyDataDir,
                onMigrateDataDir: migrateDataDir,
                onUseCandidate: useCandidate,
                onResetDataDir: resetDataDir,
                onMode: changeMode,
                onResearch: changeResearch,
                onLang: changeLang,
                onGap: changeGap,
              })
            : tab === 'overview'
            ? h(OverviewTab, {
                loading: loading,
                stats: stats,
                trace: trace,
                experts: experts,
                taxonomy: taxonomy,
                onOpenExpert: function (id) { jumpTo(id, false) },
                onOpenGap: function (id) { jumpTo(id, true) },
              })
            : tab === 'experts'
            ? experts.length === 0
              ? loading
                ? h('div', { style: styles.empty }, '正在读取…')
                : h(
                  'div',
                  { style: styles.empty },
                  h('b', { style: styles.emptyTitle }, '这里还没有专家'),
                  '在对话里说「建一个 XX 专家」，或者把一份资料搬进来。',
                )
              : (function () {
                var byId = {}
                experts.forEach(function (item) { byId[item.id] = item })
                var groups = (taxonomy && taxonomy.length ? taxonomy : []).map(function (group) {
                  var members = Array.isArray(group.experts) ? group.experts : []
                  // 总入口（router）不在专家列表里，单独一条「入口」线，不画成专家卡。
                  var entry = null
                  var list = []
                  members.forEach(function (ref) {
                    if (byId[ref.id]) list.push(byId[ref.id])
                    else if (!entry) entry = { id: ref.id, title: ref.title }
                  })
                  if (!members.length && !group.count) {
                    list = experts.filter(function (item) { return item.level1 === group.title })
                  }
                  return { id: group.id || group.title, title: group.title, experts: list, entry: entry }
                })
                if (groups.length === 0) {
                  groups = [{ id: 'all', title: '全部专家', experts: experts }]
                }
                var current = groups.filter(function (group) { return group.title === cat })[0] || null
                if (!current) {
                  var total = experts.length
                  return h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: 2 } },
                    h('div', { style: { fontSize: 12, color: MUTED, marginBottom: 8 } },
                      '共 ' + total + ' 位专家，按大类分开；点一类进去看那一类的专家。'),
                    groups.map(function (group) {
                      return h(
                        'button',
                        {
                          key: group.id,
                          style: styles.catRow,
                          onClick: function () { setCat(group.title); setOpen(null) },
                        },
                        h('span', { style: styles.catName }, group.title),
                        h('span', { style: { flex: 1, minWidth: 0 } },
                          group.experts.length || group.entry
                            ? group.experts.map(function (item) { return item.title || item.id })
                              .concat(group.entry ? [group.entry.title + '（入口）'] : [])
                              .join('、')
                            : '这一类还没有专家'),
                        group.experts.length
                          ? h('span', { style: styles.catCount }, group.experts.length + ' 位')
                          : null,
                        group.experts.length || group.entry
                          ? h('span', { style: { color: MUTED, fontSize: 13 } }, '→')
                          : null,
                      )
                    }),
                    h(
                      'div',
                      { style: styles.routerNote },
                      '技能目录里只有一张总入口卡「专家资料库」（expert-library）：模型先看它，再用查资料工具分到上面的某位专家。',
                    ),
                  )
                }
                return h(
                  'div',
                  null,
                  h(
                    'button',
                    { style: styles.catBack, onClick: function () { setCat(''); setOpen(null) } },
                    '← 所有大类',
                  ),
                  h('div', { style: { fontSize: 17, fontWeight: 600, margin: '10px 0 2px' } }, current.title),
                  h('div', { style: { fontSize: 12, color: MUTED, marginBottom: 12 } },
                    current.experts.length + ' 位专家'),
                  current.entry
                    ? h('div', { style: styles.routerNote },
                      '入口：' + current.entry.title + '（' + current.entry.id + '）；它只负责把问题分到别的类，不存资料。')
                    : null,
                  current.experts.length === 0
                    ? h('div', { style: styles.empty }, '这一类还没有专家。')
                    : current.experts.map(function (item) {
                      return h(ExpertCard, {
                        key: item.id,
                        expert: item,
                        last: lastUsedOf(trace, item.id),
                        open: open === item.id,
                        onToggle: function () { setOpen(open === item.id ? null : item.id) },
                        files: open === item.id ? files : [],
                        content: open === item.id ? content : null,
                        onOpen: onOpen,
                        onGapDecision: decideGap,
                        gapRuns: gapRuns,
                        onGapResearch: function (expertId, key) { decideGap(expertId, key, 'research') },
                        trace: trace,
                      })
                    }),
                )
              })()
            : tab === 'sessionLog'
            ? h(SessionLogTab, { entries: sessionLog, taxonomy: taxonomy, loading: loading })
            : tab === 'audit'
            ? h(AuditTab, { audit: audit, loading: loading, experts: experts })
            : h(TraceTab, { trace: trace, experts: experts, loading: loading }),
        ),
      )
    }

    // 会话动态：8 个大类会话每轮结束记一条，只做历史，不提醒。
    function SessionLogTab(props) {
      var entries = props.entries || []
      var loading = props.loading
      var titles = {}
      ;((props.taxonomy) || []).forEach(function (group) { titles[Number(group.order)] = group.title })
      var needed = entries.filter(function (entry) { return entry.need })
      var head = h(
        'div',
        { style: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 } },
        h(
          'span',
          { style: { fontSize: 13, color: MUTED, lineHeight: '20px' } },
          '8 个大类会话每跑完一轮就记一条：谁、说了什么、用了几次工具。只是历史，不需要盯着。',
        ),
        needed.length
          ? h(
              'span',
              { style: { fontSize: 13, color: '#b45309', lineHeight: '20px' } },
              '其中 ' + needed.length + ' 条在等你：要花额度、要改别类资料或要新建专家。',
            )
          : null,
      )
      if (!entries.length) {
        return h('div', {}, head, h('div', { style: styles.empty }, loading ? '正在读取…' : '这 8 个会话还没说过话。它们跑过之后，这里会有记录。'))
      }
      var byCat = {}
      entries.forEach(function (entry) {
        var key = Number(entry.cat) || 0
        if (!byCat[key]) byCat[key] = []
        byCat[key].push(entry)
      })
      var keys = Object.keys(byCat).map(Number).sort(function (a, b) { return a - b })
      var KIND_TEXT = { spend: '要花额度', cross: '要改别类资料', 'new-expert': '要新建专家', other: '要你看' }
      var needBlock = needed.length
        ? h(
            'div',
            { key: 'need', style: { marginBottom: 24 } },
            h(
              'div',
              { style: { display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 8, borderBottom: '1px solid ' + BORDER } },
              h('span', { style: { fontSize: 15, fontWeight: 600 } }, '要你看'),
              h('span', { style: { fontSize: 12, color: MUTED } }, needed.length + ' 条'),
            ),
            needed.map(function (entry, index) {
              var text = String(entry.reason || entry.text || '').replace(/\s+/g, ' ').trim()
              var short = text.length > 110 ? text.slice(0, 110) + '…' : text
              return h(
                'div',
                { key: 'need-' + index, style: { display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px dashed ' + BORDER } },
                h('span', { style: { fontSize: 12, color: MUTED, minWidth: 40, paddingTop: 3 } }, entry.ts ? timeText(entry.ts).slice(0, 5) : ''),
                h('span', { style: { fontSize: 12, color: '#b45309', minWidth: 96, paddingTop: 3 } }, KIND_TEXT[entry.needKind] || '要你看'),
                h('span', { style: { fontSize: 13, color: MUTED, minWidth: 84, paddingTop: 3 } }, String(Number(entry.cat) || 0).padStart(2, '0') + ' ' + (titles[Number(entry.cat)] || '')),
                h('span', { style: { fontSize: 14, lineHeight: '22px', color: STRONG, flex: 1, minWidth: 0 } }, short),
              )
            }),
          )
        : null
      var blocks = keys.map(function (key) {
        var rows = byCat[key]
        var title = titles[key] || ('第 ' + key + ' 类')
        return h(
          'div',
          { key: 'cat-' + key, style: { marginBottom: 24 } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 8, borderBottom: '1px solid ' + BORDER } },
            h('span', { style: { fontSize: 15, fontWeight: 600 } }, String(key).padStart(2, '0') + ' ' + title),
            h('span', { style: { fontSize: 12, color: MUTED } }, rows.length + ' 轮'),
          ),
          rows.map(function (entry, index) {
            var text = String(entry.text || '').replace(/\s+/g, ' ').trim()
            var short = text.length > 110 ? text.slice(0, 110) + '…' : text
            return h(
              'div',
              {
                key: 'row-' + key + '-' + index,
                style: { display: 'flex', gap: 16, padding: '10px 0', borderBottom: '1px dashed ' + BORDER },
              },
              h(
                'span',
                { style: { fontSize: 12, color: MUTED, minWidth: 40, paddingTop: 3 } },
                entry.ts ? timeText(entry.ts).slice(0, 5) : '',
              ),
              h(
                'div',
                { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 } },
                h('span', { style: { fontSize: 14, lineHeight: '22px', color: STRONG } }, short),
                h(
                  'span',
                  { style: { fontSize: 12, color: MUTED } },
                  (entry.chars || 0) + ' 字 · 用了 ' + (entry.tools || 0) + ' 次工具',
                ),
              ),
            )
          }),
        )
      })
      return h('div', {}, head, needBlock, blocks)
    }

    // 自检：结论在前、有问题的置顶、其余按专家分组；数据全部来自本地记录。
    function AuditTab(props) {
      var data = props.audit
      if (!data) return h('div', { style: styles.empty }, props.loading ? '正在读取…' : '这里还没有自检记录。')
      var rows = data.rows || []
      var summary = data.summary || { days: 7, total: 0, risky: 0, rate: 0, byReason: {} }
      var labels = data.labels || {}
      var titleOf = {}
      ;(props.experts || []).forEach(function (item) { titleOf[item.id] = item.title || item.id })

      function firstReason(row) { return (row.reasons || [])[0] || null }
      function expertOf(row) { var top = row.top || []; return (top[0] && top[0].expert) || '' }
      function rowLine(row, risky) {
        var top = row.top || []
        var reason = firstReason(row)
        var meta = (titleOf[expertOf(row)] || expertOf(row) || '未知专家')
        if (top[0] && top[0].score) meta += ' · ' + Number(top[0].score).toFixed(2)
        if (row.ts) meta += ' · ' + timeText(row.ts)
        return h(
          'div',
          { key: (row.ts || '') + row.query, style: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 0', borderTop: '1px solid ' + BORDER } },
          h('span', {
            style: { width: 8, height: 8, borderRadius: '50%', flex: '0 0 8px', marginTop: 7, background: risky ? (reason === 'empty' ? '#b42318' : '#b45309') : '#15803d' },
          }),
          h(
            'div',
            { style: { flex: 1, minWidth: 0 } },
            h('div', { style: { fontSize: 13.5, lineHeight: '20px' } }, row.query),
            h('div', { style: { fontSize: 12, color: MUTED, marginTop: 2 } }, meta),
          ),
          risky && reason
            ? h(
              'span',
              { style: { fontSize: 11, lineHeight: '20px', height: 22, padding: '0 8px', borderRadius: 999, whiteSpace: 'nowrap', color: '#b45309', background: '#fff7ed', border: '1px solid #fed7aa' } },
              labels[reason] || reason,
            )
            : null,
        )
      }

      var riskyRows = rows.filter(function (row) { return (row.reasons || []).length > 0 })
      var cleanRows = rows.filter(function (row) { return (row.reasons || []).length === 0 })
      var groups = []
      var index = {}
      cleanRows.forEach(function (row) {
        var id = expertOf(row) || 'unknown'
        if (!index[id]) { index[id] = { id: id, rows: [] }; groups.push(index[id]) }
        index[id].rows.push(row)
      })
      groups.sort(function (a, b) { return b.rows.length - a.rows.length })

      return h(
        'div',
        null,
        h(
          'div',
          { style: { fontSize: 15, lineHeight: '24px' } },
          '本周查了 ' + summary.total + ' 次，其中 ' + summary.risky + ' 条可能有问题（' + percentText(summary.rate) + '）。',
        ),
        h(
          'div',
          { style: { fontSize: 12, color: MUTED, marginTop: 4 } },
          '分数低多半是库里没有这条资料；跨专家多半是问法偏了，可以从旁边那位专家再查一次。',
        ),
        riskyRows.length
          ? h(
            'div',
            { style: { marginTop: 22 } },
            h('div', { style: { fontSize: 17, fontWeight: 600, lineHeight: '26px' } }, '需要处理（' + riskyRows.length + '）'),
            h('div', { style: { fontSize: 12, color: MUTED, marginTop: 4 } }, '只放有问题的，最多 5 条；补上资料或换个问法后，新记录会替代它们。'),
            riskyRows.slice(0, 5).map(function (row) { return rowLine(row, true) }),
          )
          : null,
        h(
          'div',
          { style: { marginTop: 22 } },
          h('div', { style: { fontSize: 17, fontWeight: 600, lineHeight: '26px' } }, '其余记录（' + cleanRows.length + '）'),
          h('div', { style: { fontSize: 12, color: MUTED, marginTop: 4 } }, '按专家分组，同一件事并成一条。'),
          groups.length === 0
            ? h('div', { style: { fontSize: 12, color: MUTED, marginTop: 10 } }, '还没有顺利查到的记录。')
            : groups.map(function (group) {
              return h(
                'div',
                { key: group.id },
                h(
                  'div',
                  { style: { fontSize: 11.5, letterSpacing: '.04em', color: MUTED, margin: '14px 0 2px' } },
                  (titleOf[group.id] || group.id) + '（' + group.rows.length + '）',
                ),
                group.rows.map(function (row) { return rowLine(row, false) }),
              )
            }),
        ),
      )
    }

    // 左栏行只画图标，按钮、文字、激活态都由外壳负责。
    function PanelIcon(props) {
      var size = props && props.size ? props.size : 16
      return h(
        'svg',
        {
          'data-dsh-panel-entry': 'expert-library',
          viewBox: '0 0 16 16',
          width: size,
          height: size,
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.3,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M8 3 14 5.8 8 8.6 2 5.8Z' }),
        h('path', { d: 'M4.8 7.4v3.2' }),
        h('path', { d: 'M11.2 7.4v3.2' }),
        h('path', { d: 'M4.8 10.6c0 1.5 1.4 2.3 3.2 2.3s3.2-.8 3.2-2.3' }),
        h('path', { d: 'M13.6 6.4v4' }),
      )
    }

    function apply(ctx) {
      ctx.effect(function () {
        var disposers = []
        disposers.push(
          ctx.slots.inject('sidebar.panellist', function () {
            return ctx.slots.register(
              { name: 'sidebar.panellist', id: 'expert-library', order: 35, label: function () { return '专家库' } },
              PanelIcon,
            )
          }),
        )
        disposers.push(
          ctx.slots.inject('main', function () {
            return ctx.slots.register({ name: 'main', key: 'expert-library' }, Panel)
          }),
        )
        return function () {
          disposers.forEach(function (dispose) { dispose() })
        }
      }, 'expert-role.panel')
    }

    exports.name = 'dsh-expert-role'
    exports.inject = ['slots']
    exports.apply = apply
    return module.exports
  },
})
