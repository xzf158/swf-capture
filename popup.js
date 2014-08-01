var zipFs = new zip.fs.FS(),
    tmpDir = "/swf",
    pixelRatio = window.devicePixelRatio,
    progress, progressBar, result, saveForm, matches = ['http://*/*', 'https://*/*', 'ftp://*/*', 'file://*/*'],
    noMatches = [/^https?:\/\/chrome.google.com\/.*$/],
    total = 0, createJpgIndex = 0;
    canvasList = [];

zip.workerScriptsPath = "zip/";

function createTmpDirectory() {
    window.webkitRequestFileSystem(window.TEMPORARY, 1024 * 1024, function(fs) {
        fs.root.getDirectory(tmpDir, {}, function(dirEntry) {
            dirEntry.removeRecursively(function() {
                create(fs);
            }, function() {
                create(fs);
            });
        }, function() {
            create(fs);
        });
    });

    function create(fs) {
        fs.root.getDirectory(tmpDir, {
            create: true
        }, function(dirEntry) {
        });
    };
};

function createFile(filename, callback) {
    webkitRequestFileSystem(TEMPORARY, 4 * 1024 * 1024, function(fs) {
        fs.root.getFile(filename, {
            create: true
        }, callback);
    });
}
// return;

function testURLMatches(url) {
    var r, i;
    for (i = noMatches.length - 1; i >= 0; i--) {
        if (noMatches[i].test(url)) {
            return false;
        }
    }
    for (i = matches.length - 1; i >= 0; i--) {
        r = new RegExp('^' + matches[i].replace(/\*/g, '.*') + '$');
        if (r.test(url)) {
            return true;
        }
    }
    return false;
}

function checkSwf() {
    chrome.tabs.getSelected(null, function(tab) {
        if (testURLMatches(tab.url)) {
            var loaded = false;
            chrome.tabs.executeScript(tab.id, {
                file: "jquery-2.0.3.min.js"
            }, function() {
                chrome.tabs.executeScript(tab.id, {
                    file: 'page.js'
                }, function() {
                    loaded = true;
                    chrome.tabs.sendRequest(tab.id, {
                        msg: 'checkSwf'
                    }, function(count) {
                        total = count;
                        if (count == 0) {
                            result.removeClass('alert-success').addClass('alert-error').html("<strong>Oop! </strong>No flash found.");
                        } else {
                            result.html("<strong>Hooray!</strong> Found <strong>" + count + "</strong> flash file.");
                        }
                    });
                });
            });
            window.setTimeout(function() {
                if (!loaded) {
                    result.removeClass('alert-success').addClass('alert-error').html("<strong>Oop! </strong> Error.");
                }
            }, 1000);
        } else {
            result.removeClass('alert-success').addClass('alert-error').html("<strong>Oop! </strong>No flash found.");
        }
    });
}

function showProgress(p) {
    progress.show();
    progressBar.css("width", p + "%");
};

function captureComplete() {
    result.html("<strong>HaHa!</strong> You can save now.");
    progress.hide();
    saveForm.show().fadeIn();
}

function captureSwf(data, sender, callback) {
    var canvas, ctx;
    canvas = document.createElement('canvas');
    canvas.width = data.width;
    canvas.height = data.height;
    ctx = canvas.getContext('2d');

    chrome.tabs.captureVisibleTab(
    null, {
        format: 'png',
        quality: 100
    }, function(dataURI) {
        if (dataURI) {
            var image = new Image();
            image.onload = function() {
                ctx.drawImage(image, data.offset.left * pixelRatio, data.offset.top * pixelRatio, canvas.width * pixelRatio, canvas.height * pixelRatio, 0, 0, canvas.width, canvas.height); //data.x, data.y
                canvasList.push({
                    canvas: canvas,
                    name: data.name
                });
                callback(true);
                showProgress(canvasList.length / total  *100);
                if (total == canvasList.length) {
                    captureComplete();
                }
            };
            image.src = dataURI;
        }
    });
}

function saveTmpImage(canvas, name, callback, kSize) {
    var quality = 1,
        blob, fileName;
    do {
        var dataURI = canvas.toDataURL("image/jpeg", quality);
        var byteString = atob(dataURI.split(',')[1]);
        var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
        var ab = new ArrayBuffer(byteString.length);
        var ia = new Uint8Array(ab);

        for (var i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i);
        }

        blob = new Blob([ab], {
            type: mimeString
        });
        fileName = tmpDir + "/" + name + ".jpg";
        quality -= 0.02;
    } while (blob.size / 1024 > kSize && quality > 0.2);

    function onwriteend() {
        createJpgIndex ++;
        if(createJpgIndex < total){
            saveTmpImage(canvasList[createJpgIndex].canvas, canvasList[createJpgIndex].name, callback, kSize);
        }else{
            callback(true);
        }
    }

    function errorHandler() {
        result.removeClass('alert-success').addClass('alert-error').html(fileName);
        callback(false);
    }

    // create a blob for writing to a file
    window.webkitRequestFileSystem(TEMPORARY, 1024 * 1024, function(fs) {
        fs.root.getFile(fileName, {
            create: true
        }, function(fileEntry) {
            zipFs.root.addFileEntry(fileEntry);
            fileEntry.createWriter(function(fileWriter) {
                fileWriter.onwriteend = onwriteend;
                fileWriter.write(blob);
            }, errorHandler);
        }, errorHandler);
    }, errorHandler);
}

chrome.extension.onRequest.addListener(function(request, sender, callback) {
    if (request.msg === "captureSwf") {
        captureSwf(request, sender, callback);
    } else {
        console.error('Unknown message received from content script: ' + request.msg);
    }
});

$(function() {
    progress = $("#progress");
    progressBar = $("#progress .bar");
    result = $("#result");
    saveForm = $("#save-form");

    createTmpDirectory();

    checkSwf();

    $("#save-btn").on("click", function() {
        var kSize = parseInt($("#appendedInput").val());
        createJpgIndex = 0;
        saveTmpImage(canvasList[createJpgIndex].canvas, canvasList[createJpgIndex].name, function() {
            var zipName = tmpDir + "/" + Date.now() + ".zip";//parseInt(Math.random() * 9999)
            createFile(zipName, function(fileEntry) {
                zipFs.root.exportFileEntry(fileEntry, function() {
                    window.open('filesystem:chrome-extension://' + chrome.i18n.getMessage('@@extension_id') + '/temporary' + zipName);
                });
            });
        }, kSize);
        return false;
    });
});