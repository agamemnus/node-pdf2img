"use strict"

var fs = require('fs')
var gm = require('gm')
var path = require('path')
var async = require('async')
var options = {type: 'jpg', size: 1024, density: 600, outputdir: null, outputname: null, page: null, startindex: 1}
var Pdf2Img = function () {}

Pdf2Img.prototype.setOptions = function (opts) {
 options.type = opts.type || options.type
 options.size = opts.size || options.size
 options.density = opts.density || options.density
 options.outputdir = opts.outputdir || options.outputdir
 options.outputname = opts.outputname || options.outputname
 options.page = opts.page || options.page
 options.startindex = ('startindex' in opts) ? opts.startindex : options.startindex
}

Pdf2Img.prototype.convert = function (input, callbackreturn) {
 // Make sure it has the correct extension.
 if (path.extname(path.basename(input)) != '.pdf') return callbackreturn({result: 'error', message: 'Unsupported file type.'})
 
 // Check if the input file exists.
 if (!fileExists(input)) return callbackreturn({result: 'error', message: 'Input file not found.'})
 
 var stdout = [], output = path.basename(input, path.extname(path.basename(input)))
 
 // Set the output dir.
 options.outputdir = (options.outputdir) ? (options.outputdir + path.sep) : (output + path.sep)
 
 // Create the output dir if it doesn't exist.
 if (!dirExists(options.outputdir)) fs.mkdirSync(options.outputdir)
 
 // Set the output name.
 options.outputname = (options.outputname) ? options.outputname : output
 
 async.waterfall([
  // Get the page count.
  function (callback) {
   var cmd = 'gm identify -format "%p " "' + input + '"'
   var execSync = require('child_process').execSync
   var pageCount = execSync(cmd).toString().match(/[0-9]+/g)
   if (!pageCount.length) {return callback({result: 'error', message: 'Invalid page number.'}, null)}
   
   // Convert the selected page.
   if (options.page !== null) {
    if (options.page < pageCount.length) {
     return callback(null, [options.page])
    } else {
     return callback({result: 'error', message: 'Invalid page number.'}, null)
    }
   }
   return callback(null, pageCount);
  },
  // Convert the pdf file.
  function (pages, callback) {
   // Use eachSeries to make sure that conversion was done, page-by-page.
   async.eachSeries(pages, function (page, callbackmap) {
    var inputStream = fs.createReadStream(input)
    var outputFile = options.outputdir + options.outputname + '_' + (+page + options.startindex - 1) + '.' + options.type
    convertPdf2Img(inputStream, outputFile, parseInt(page), function (error, result) {
     if (error) return callbackmap(error)
     callbackreturn(null, {result: 'page_processed', message: result})
     stdout.push(result)
     return callbackmap(error, result)
    })
   }, function (e) {if (e) callback(e); return callback(null, {result: 'success', message: stdout})})
  }
 ], callbackreturn)
}

var convertPdf2Img = function (input, output, page, callback) {
 if (!input.path) return callback({result: 'error', message: 'Invalid input file path.'}, null)
 var filepath = input.path, filename = filepath + '[' + (page - 1) + ']'
 
 gm(input, filename)
 .density(options.density, options.density)
 .resize(options.size)
 .quality(100)
 .write(output, function (err) {
  if (err) return callback({result: 'error', message: 'Can not write output file.'}, null) 
  if (!(fs.statSync(output)['size'] / 1000)) return callback({result: 'error', message: 'Zero sized output image detected.'}, null)
  var results = {page: page, name: path.basename(output), size: fs.statSync(output)['size'] / 1000.0, path: output}  
  return callback(null, results)
 })
}

// Check if the directory exists.
var dirExists = function (path) {try {return fs.statSync(path).isDirectory()} catch (e) {return false}}

// Check if the file exists.
var fileExists = function (path) {try {return fs.statSync(path).isFile()} catch (e) {return false}}

module.exports = new Pdf2Img
