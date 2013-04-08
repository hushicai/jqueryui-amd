#!/usr/bin/env node
/**
 * @license Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */

/**
 * This file converts jQuery UI files to use define() syntax.
 *
 * It should be run in node (only 0.6+).
 */

/*jslint node: true, regexp: true */
/*global */
'use strict';

var fs = require('fs'),
    path = require('path'),
    optimist = require('optimist'),
    argv = optimist.argv,
    inDir,
    outDir,
    depPrefix,
    force = false,
    jsFileRegExp = /\.js$/,
    dependStartRegExp =  /\*\s+Depends\:([^\/]+)\*\//,
    dotRegExp = /\./g,
    filesRegExp = /([\w\.]+)\.js/g,
    exists = fs.existsSync || path.existsSync,
    jqUiSrcDir,
    jqPaths;

inDir = argv.s;
outDir = argv.d;
depPrefix = argv.dep;
force = argv.force;


function mkDir(dir) {
    if (!exists(dir)) {
        //511 is decimal for 0777 octal
        fs.mkdirSync(dir, 511);
    }
}

function readFile(filePath) {
    var text = fs.readFileSync(filePath, 'utf8');

    //Remove BOM just in case
    if (text.indexOf('\uFEFF') === 0) {
        text = text.substring(1, text.length);
    }

    return text;
}

/**
 * Converts the contents of a file to an AMD module.
 * @param {String} contents the file contents.
 */
function convert(fileName, contents) {
    //Find dependencies.
    var moduleName, outFileName, i, segment,
        match = dependStartRegExp.exec(contents),
        files = ["'jquery'"],
        fileParts = fileName.split('.'),
        tempDir = outDir;

    //Strip off .js extension and convert jquery-ui to jqueryui,
    //generate module name.
    fileParts.pop();
    if (fileParts[0].indexOf('jquery-ui-i18n') !== -1) {
        // moduleName = 'datepicker-i18n';
        // fileParts.unshift('datepicker-i18n');
        fileParts = fileParts[0].split('-');
        fileParts[fileParts.length - 1] = 'datepicker-i18n';
        // outFileName = outDir + moduleName + '.js';
    } 
    //convert preceding 'jquery' to 'jqueryui'
    fileParts[0] = 'jqueryui';
    //remove .ui from path since it is implied already from
    //top level 'jqueryui' name.
    if (fileParts[1] === 'ui') {
        fileParts.splice(1, 1);
    }
    moduleName = fileParts.join('/');
    outFileName = outDir + moduleName + '.js';

    //If fileParts' last piece is a datepicker i18n bundle, make datepicker
    //an explicit dependency for it.
    if (fileParts[fileParts.length - 1].indexOf('datepicker-') === 0) {
        files.push("'"+ depPrefix +"datepicker'");
    }

    //Make sure directories exist in the jqueryui section.
    if (moduleName !== 'jqueryui' && fileParts.length > 1) {
        for (i = 0; i < fileParts.length - 1; i += 1) {
            segment = fileParts[i];
            tempDir += segment + '/';
            mkDir(tempDir);
        }
    }

    if (match) {
        match[1].replace(filesRegExp, function (match, depName) {
            files.push("'"+ depPrefix +"" + depName
                             //Remove .ui from the name if it is there,
                             //since it is already implied by the jqueryui
                             //name
                             .replace(/\.ui\./, '.')
                             .replace(/^jquery\./, '')
                             //Convert to module name.
                             .replace(dotRegExp, '/') +
                       "'");
        });
    }

    contents = 'define(' +
           '[' + files.join(',') + '], function (jQuery) {\n' +
           contents +
           '\n});';

    fs.writeFileSync(outFileName, contents);
}

//Make sure required fields are present.
if (!inDir) {
    console.log('Usage: jqueryui-amd --s=inputDir --d=outDir --dep=dependPrefix');
    process.exit(1);
}



//Normalize directory
inDir = path.normalize(inDir);

if (!outDir) {
    outDir = inDir;
}
if (outDir.lastIndexOf('/') !== outDir.length - 1) {
    outDir += '/';
}
if (!depPrefix) {
    depPrefix = './';
}
if (depPrefix.lastIndexOf('/') !== depPrefix.length - 1) {
    depPrefix += '/';
}
//Make sure there is a ui directory in there, otherwise cannot
//convert correctly.
jqUiSrcDir = path.join(inDir, 'ui/');

if (!exists(jqUiSrcDir) || !fs.statSync(jqUiSrcDir).isDirectory()) {
    console.log('Directory "'+ inDir +'" does not appear to contain jQuery UI, ' +
                'not converting any files. Looking for "ui" directory ' +
                'in the source directory failed.');
    process.exit(1);
}

//For each file that is a sibling to jquery-ui, transform to define.
jqPaths = fs.readdirSync(jqUiSrcDir);
jqPaths.forEach(function (fileName) {
    var srcPath = jqUiSrcDir + fileName;
    if (fs.statSync(srcPath).isFile() && jsFileRegExp.test(srcPath)) {
        //console.log("Converting file: " + convertPath);
        convert(fileName, readFile(srcPath));
    }
});

//Transform the i18n files.
jqPaths = fs.readdirSync(jqUiSrcDir + 'i18n');
jqPaths.forEach(function (fileName) {
    var srcPath = jqUiSrcDir + 'i18n/' + fileName;
    if (fs.statSync(srcPath).isFile() && jsFileRegExp.test(srcPath)) {
        //console.log("Converting file: " + convertPath);
        convert(fileName, readFile(srcPath));
    }
});

console.log("Done. See " + path.join(outDir, 'jqueryui') + ' for the AMD modules.');
