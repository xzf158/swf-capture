function onMessage(request, sender, callback) {
	if (request.msg === 'checkSwf') {
		checkSwf(callback);
	}else{
		console.error('Unknown message received from background: ' + request.msg);
	}
}

if (!window.hasCheckSwf) {
	window.hasCheckSwf = true;
	chrome.extension.onRequest.addListener(onMessage);
}
var swfObjs = [], swfDatas = [],
	index = 0;

function checkSwf(callback) {
	$("object").each(function (){
		var $this = $(this);
		if($this.children("object").length > 0){
			return;
		}
		if($this.attr("type").toLowerCase() == "application/x-shockwave-flash" || $this.attr("data").toLowerCase().indexOf(".swf") > 0 || $this.find("param[name='movie']").length > 0){
			swfObjs.push($this);
		}
	});

	for (var i = 0, il = swfObjs.length; i < il; i++) {
		var name;
		if(swfObjs[i].attr("data")){
			var tmp = swfObjs[i].attr("data").split("/");
			var name = tmp[tmp.length-1].toLowerCase().replace(".swf", "");
		}else{
			name = parseInt(Math.random()*99999);
		}
		
		var data = {
			msg: "captureSwf",
			width: swfObjs[i].width(),
			height: swfObjs[i].height(),
			name: name//"backup_" + i
		};
		swfDatas.push(data);
	}

	if(swfObjs.length > 0){
		setTimeout(function(){
			captureSwf(0);
		}, 50);
	}
	console.log(swfObjs);
	callback(swfObjs.length);
};

function captureSwf(i) {
	if (i >= swfDatas.length) {
		return;
	}
	checkScroll(swfObjs[i]);
	setTimeout(function() {
		swfDatas[i].offset = swfObjs[i].offset();
		console.log(swfDatas[i]);
		chrome.extension.sendRequest(swfDatas[i], function(captured) {
			if (captured) {
				index ++;
				if(index < swfDatas.length){
					captureSwf(index);
				}
			} else {
				console.log("error");
			}
		});
	}, 50);
};

function checkScroll(el) {
	var parent = el.parent();
	var offset = el.offset();
	while (parent.length > 0) {
		var overflow = parent.css("overflow");
		if ((parent[0].scrollHeight != parent.height || parent[0].scrollWidth != parent.width) && (overflow == "auto" || overflow == "scroll")) {
			var pOffset = parent.offset();
			parent.scrollTop(parent.scrollTop() + offset.top - pOffset.top);
			break;
		}
		parent = parent.parent();
	}
}