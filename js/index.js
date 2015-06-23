var dateformat = require('dateformat')

/**
  ~~ Config ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
var cfg = {
  lastSelectedLog: NaN,
  pollFrequency: 300,
  transitionTime: 170,
  lastRun: 0,
  coolDownTime: 1000,
  icon: {
    success: ['ok-circle', '#5cb85c'],
    warning: ['ban-circle', '#f0ad4e'],
    danger: ['remove-circle', '#c9302c']
  },
  
  logFilesList: [],
  logFilesListHTML: "",
  shownLog: {
    id: 0, offset: 0, lines: 75, data: [] }
}

/**
  ~~ BorgBackup interaction ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
var noBackupRunning = function (callback) {
  $.getJSON('backup/status', function (resp) {
    var backupRunning = resp.rc === null
    if (backupRunning) log("▶ Backup in progress")
    else log("✖ No backup in progress")
    callback(!backupRunning)
  })
}
var pollBackupStatus = function (endpoint, ms, callback) {
  noBackupRunning(function (notRunning) {
    if (notRunning) {
      $('.navbar button[type=submit]').toggleClass('btn-success')
      $('.navbar button[type=submit]').toggleClass('btn-warning')
      $('.navbar button[type=submit]').text("▶ Start Backup")
      $.getJSON('logs', updateLogFileList)
    } else {
      log("Polling backup status")
      $.getJSON('backup/status', callback)
      setTimeout(function () { pollBackupStatus(endpoint, ms, callback) }, ms)
    }
  })
}
var stopBackup = function () {
  log("Terminating (eventually killing) the backup process")
  $.post('backup/stop', {}, function (res) {
    log("Message: '" + res.msg + "', RC: '" + res.rc + "'") })
}
var startBackup = function (force) {
  if (force) {
    log("Sending backup start request")
    if (Date.now() - cfg['lastRun'] >= cfg['coolDownTime']) {
      cfg['lastRun'] = Date.now()
      $.post('backup/start', {}, function () {
        $('.navbar button[type=submit]').toggleClass('btn-success')
        $('.navbar button[type=submit]').toggleClass('btn-warning')
        $('.navbar button[type=submit]').text("✖ Stop Backup")
        pollBackupStatus('backup/status', cfg['pollFrequency'],
          function (res) {
            log("Received status update")
          }) })
    } else log('Restarting backup too fast, ignoring')
  } else if (force === undefined) noBackupRunning(startBackup)
    else {
    stopBackup()
  }
}

/**
  ~~ Utility ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
var log = function(){
  var args = Array.prototype.slice.call(arguments)
  var time = '[' + dateformat(new Date(), 'HH:MM:ss') + ']'
  args.unshift(time)
  console.log.apply(console, args);
  return this
}
var isInt = function (n) {
  return n % 1 === 0
}
var success = function (data) {
  logFiles = data.log_files
}
var parseAnchor = function () {
  var url = window.location.href.toString()
  var idx = url.indexOf("#")
  var anchor = (idx != -1) ? url.substring(idx+1) : ""
  if (anchor) {
    var parts = anchor.split(';')
    var partsParsed = {}
    parts.forEach(function (e) {
      var pair = e.split(':')
      partsParsed[pair[0]] = pair[1]
    })
    return partsParsed
  } else return {'log': 0}
}

/**
  ~~ UI updaters ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
var updateLogFileList = function (logFiles) {
  log("Updating log file list")
  cfg.logFilesListHTML = []
  $.each(logFiles.files, function (key, value) {
    cfg.logFilesListHTML += '<li><a href="#log:' + value[0] + '" id="log-' + value[0]
      + '" onClick="window.showLog('
      + value[0] + ')">' + value[1] + '</a></li>' })
  $('#log-files').html(cfg.logFilesListHTML)
  log("Highlighting log # " + parseInt(cfg['shownLog']['id']))
  $('#log-' + parseInt(cfg['shownLog']['id'])).focus()
}
var appendLog = function (data, overwrite) {
  // set status icon:
  $.getJSON('logs/' + cfg['shownLog']['id'], function (res) {
    log("Requesting backup status")
    $('#log-path').html('<span class="glyphicon glyphicon-' + cfg['icon'][res.status][0]
      + '" aria-hidden="true" style="color: ' + cfg['icon'][res.status][1]
      + '; width: 20px; height: 24px; vertical-align: top;"></span> ' + res.filename )
  })
  
  // append log text:
  var logText = $('#log-text')
  if (cfg['shownLog']['offset'] === 0 || overwrite) logText.html('')
  data.lines.forEach(function (val, index) { logText.append(val[1] + '\n') })
  $('#loadMore').remove()
  cfg['shownLog']['offset'] = data.offset
  logText.after('<button id="loadMore" onClick="window.showLog('
    + cfg['shownLog']['id'] + ', ' + cfg['shownLog']['offset'] + ', '
    + cfg['shownLog']['lines'] + ')">load more</button>' )
}
var overwriteLog = function (data) { appendLog(data, true) }
var showLog = function (id, offset, lines) {
  var newLog = false
  if (id !== cfg['shownLog']['id'] || ! isInt(offset)) {
    log("Displaying different log than before")
    $('#log-text').fadeOut(cfg['transitionTime'] * 0.5)
    var args = parseAnchor()
    cfg['shownLog']['id'] = args['log'] || 0
    cfg['shownLog']['offset'] = 0
    newLog = true
  }
  cfg['shownLog']['id'] = id || cfg['shownLog']['id']
  cfg['shownLog']['offset'] = offset || cfg['shownLog']['offset']
  cfg['shownLog']['lines'] = lines || cfg['shownLog']['lines']
  var url = 'logs/' + cfg['shownLog']['id'] + '/' + cfg['shownLog']['offset']
    + ':' + cfg['shownLog']['lines']
  log("Fetching log (" + cfg['shownLog']['id'] + ', '
    + cfg['shownLog']['offset'] + ', ' + cfg['shownLog']['lines'] + ')')
  setTimeout(function () { 
    if (newLog) $.getJSON(url, overwriteLog)
    else $.getJSON(url, appendLog)
    $('#log-text').fadeIn(cfg['transitionTime'] * 0.5)
  }, cfg['transitionTime'] * 0.5)
}

/**
  ~~ UI callables ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/
window.showLog = function (id, offset, lines) { showLog(id, offset, lines) }
window.startBackup = startBackup
/**
  ~~ Site init ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
*/

$.getJSON('logs', updateLogFileList)
showLog()





