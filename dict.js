"use strict";
XML.ignoreWhitespace = false;
XML.prettyPrinting = false;
var INFO =
<plugin name="dict.js" version="0.9.0"
    href="https://github.com/grassofhust/dict.js"
    summary="An online dict."
    xmlns={NS}>
    <author email="frederick.zou@gmail.com">Yang Zou</author>
    <license href="http://opensource.org/licenses/mit-license.php">MIT</license>
    <project name="Pentadactyl" minVersion="1.0"/>
      <p>
      A dict plugin for pentadactyl, dict.js only support dict.cn now.
      I will add google translate later.
      </p>

      <p>
      Dict.js use mpg321 to support sound, you can use other program (:set dict-audioplayer=mplayer)
      or just disable it (:set dict-hasaudio=false).
      </p>

      <item>
        <tags>'dich' 'dict-hasaudio'</tags>
        <spec>'dict-hasaudio' 'dich'</spec>
        <type>boolean</type>
        <default>true</default>
        <description>
          <p>
          Toggle sound on or off.
          </p>
        </description>
      </item>

      <item>
        <tags>'dica' 'dict-audioplayer'</tags>
        <spec>'dict-audioplayer' 'dica'</spec>
        <type>string</type>
        <default>mpg321</default>
        <description>
        <p>
          External audio player, may be work not well on Windows.
          </p>
        </description>
      </item>
</plugin>;

let google = {
	keyword: "",
	url: "",
	init: function(args) {

	}
};

let dict_cn = {
	// http://dict.cn/tools.html
	keyword: "",
	url: "",
	init: function(keyword) {
		var req = new XMLHttpRequest();
		dict_cn.keyword = keyword;
		dict_cn.url = "http://dict.cn/"+keyword;
		req.open("POST",
			"http://dict.cn/ws.php?utf8=true&q="+keyword,
			true
		);
		req.onreadystatechange = function(ev) {
			dict.dict_cn(req);
		};
		req.send(null);
		dict.req = req;
		return req;
	},

	process: function(text) {
		let ret = {
			notfound: false,
			ok: true,
			pron: false,
			def: false,
			simple: false,
			full: false,
			text: false,
			audio: false
		};
		var parser = new DOMParser();
		ret['text'] = text;
		var xml = parser.parseFromString(text, "text/xml");
		var def = xml.getElementsByTagName('def');
		if (def.length && (def[0].textContent !== 'Not Found')) {

			// key
			var keyelem = xml.getElementsByTagName('key');
			ret['key'] = keyelem.length ? keyelem[0].textContent : false;
			// pron
			var pronelem = xml.getElementsByTagName('pron');
			ret['pron'] = pronelem.length ? pronelem[0].textContent : false;

			// def
			ret['def'] = dict._html_entity_decode(def[0].textContent);

			// origTrans
			var sentelems = xml.getElementsByTagName('sent');
			var origTrans = sentelems.length ? [] : false;
			for (var i = 0; i < sentelems.length; i++) {
				origTrans.push([dict._html_entity_decode(sentelems[i].firstChild.textContent),
						dict._html_entity_decode(sentelems[i].lastChild.textContent)]);
			}
			ret['origTrans'] = origTrans;

			// audio
			var audioelem = xml.getElementsByTagName('audio');
			ret['audio'] = audioelem.length ? audioelem[0].textContent : false;

			ret['simple'] = ret['key'] + ': ';
			if (ret['pron'])
				ret['simple'] += '['+ret['pron'] +'] ';
			ret['simple'] += dict._eolToSpace(ret['def']);

			ret['complex'] = 'xxx';
		} else {
			ret['notfound'] = true;
		}
		return ret;
	}
}

let dict = {
	engines: {'dict_cn' : dict_cn, 'google' : google},
	get req() dict._req || null,
	set req(req) {
		if (dict.req)
			dict.req.abort();
		dict._req = req;
	},
	get suggestReq() dict._suggestReq || null,
	set suggestReq(req) {
		if (dict.suggestReq)
			dict.suggestReq.abort();
		dict._suggestReq = req;
	},
	get keyword() dict._keyword,
	set keyword(keyword) {
		dict._keyword = encodeURIComponent(keyword.trim());
	},

	get timeout() dict._timeout || null,
	set timeout(timeout) {
		if (dict.timeout)
			dict.timeout.cancel();
		dict._timeout = timeout;
	},

	get engine() dict.engines[options.get('dict-engine').value],

	init: function(args) {
		let keyword = args.join(" ") || "";
		if (keyword.length == 0) {
			keyword = content.window.getSelection().toString() || "";
		}
		if (keyword.length == 0) {
			commandline.input("Lookup: ", function(keyword) {
					dict.keyword = keyword;
					dict.engine.init(dict.keyword);
				},
				{
					completer: function (context) {
						dict.suggest(dict.makeRequest(context, [commandline.command]), context); // this != dict
					}
				}
			);
		} else {
			dict.keyword = keyword;
			dict.engine.init(dict.keyword);
		}
	},

	// check whether we are on Windows Platform.
	isWin: function() {
		let re = /^Win/;
		return re.exec(window.navigator.platform) !== null;
	},
	process: function(ret) {
		// audio
		if (ret['audio'])
			dict._play(ret['audio']);
		else {
			let uri = 'http://translate.google.com/translate_tts?q=' + dict.keyword;
			dict._play(uri);
		}

		if (ret['notfound']) {
			dactyl.echo("未找到 " + decodeURIComponent(dict.keyword) + " 的翻译");
			// dactyl.echo("未找到<b>" + dict.keyword + "</b>的翻译");
		} else {
			if (options.get('dict-simple').value) {
				dactyl.echomsg(ret['simple'], 0, commandline.FORCE_SINGLELINE);
				dict.timeout = dactyl.timeout(dict._clear, 5000);
			} else {
				dactyl.echomsg(ret['complex']); // commandline.FORCE_MULTILINE
			}
		}
	},

	dict_cn: function(req) {
		if (req.readyState == 4) {
			let ret = {};
			if (req.status == 200)
				ret = dict_cn.process(req.responseText);
			dict.process(ret);
			req.onreadystatechange = function() {};
		}
	},

	makeRequest:  function (context, args) {
		var url = function(item, text)
		<>
		<a xmlns:dactyl={NS} identifier={item.id || ""} dactyl:command={item.command || ""}
		href={item.item.url} highlight="URL">{text || ""}</a>
		</>;
		// context.waitingForTab = true;
		context.title = ['Original', 'Translation'];
		context.keys = {"text":'g', "description":'e'};
		context.filterFunc = null;
		context.quote = ['', util.identity, ''];
		context.offset=context.value.indexOf(" ") + 1;
		context.process.push(url);
		context.key = encodeURIComponent(args.join("_"));
		if (args.length == 0) {
		} else {
			var req = new XMLHttpRequest();
			req.open("POST",
				"http://dict.cn/ajax/suggestion.php"
			);
			req.onreadystatechange = function () {
				dict.suggest(req, context);
			}
			// req.send(null);
			var formData = new FormData();
			formData.append('q', args.join(" "));
			formData.append('s', 'd');
			req.send(formData);
			dict.suggestReq = req;
			return req;
		}
	},

	suggest: function(req, context) {
		if (req.readyState == 4) {
			if (req.status == 200) {
				var result_arr = JSON.parse(req.responseText);
				var suggestions = [];
				result_arr['s'].forEach(function (r) {
						r['e'] = dict._html_entity_decode(r['e'].trim());
						r['g'] = r['g'].trim();
						r['url'] = 'http://dict.cn/' + encodeURIComponent(r['g']);
						suggestions.push(r); // trim blank chars
				});
				context.completions = suggestions;
			} else {
			}
			req.onreadystatechange = function() {};
		}
	},

	_play: function(uri) {
		if (!options.get('dict-hasaudio').value)
			return false;
		if (dict.isWin()) {
			let dict_sound = document.getElementById('dict-sound');
			if (!dict_sound) {
				let sound = util.xmlToDom(<embed id="dict-sound" src="" autostart="false" type="application/x-mplayer2" hidden="true" height="0" width="0" enablejavascript="true" xmlns={XHTML}/>, document);
				let addonbar = document.getElementById('addon-bar'); // FIXME: firefox 3.6 support
				addonbar.appendChild(sound);
				dict_sound = document.getElementById('dict-sound');
				dict_sound.setAttribute('hidden', 'false'); // dirty hack, tell me why.
				if (!dict_sound.Play)
					dict_sound.setAttribute('autostart', 'true');
			}
			dict_sound.setAttribute('src', uri);
			dict_sound.setAttribute('src', uri);
			if (dict_sound.Play)
				dict_sound.Play();
		} else {
			let cmd = ":";
			if (options.get('dict-audioplayer').value)
				cmd = options.get('dict-audioplayer').value;
			ex.silent("!" + cmd + " '" + uri + "' &"); // uri 要解析特殊字符
			// ex.silent("!" + cmd + ' ' + uri + " 0>&1 2>&1 1>/dev/null"); // uri 要解析特殊字符
		}
	},

	_clear: function() {
		dactyl.echo("");
	},

	_eolToSpace: function(str) {
		return str.replace(/\n/g, " ");
	},

	_popup: function(str, url) {
		// https://developer.mozilla.org/en/Using_popup_notifications
		// check firefox version, enable on firefox 4.0 or above.
		PopupNotifications.show(gBrowser.selectedBrowser, "dict-popup",
			str,
			null, /* anchor ID */
			{
				label: "查看详细解释",
				accessKey: "D",
				callback: function() {
					dactyl.open(url, {background:false, where:dactyl.NEW_TAB});
				}
			},
			null  /* secondary action */
		);
	},

	// http://stackoverflow.com/questions/2808368/converting-html-entities-to-unicode-character-in-javascript
	_html_entity_decode: function(str) {
		var elem = util.xmlToDom(<html:div xmlns:html={XHTML}></html:div>, content.document);
		let str_decode = str;
		try {
			elem.innerHTML = str;
			str_decode = elem.childNodes[0].nodeValue;
			str_decode = str_decode.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
		} catch (e) {
			str_decode = str_decode.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&");
		} finally {
			return str_decode;
		}
	}

};

if (!dict.isWin()) {
	options.add(["dict-audioplayer", "dicp"],
		"External audio player.",
		"string",
		'mplayer',
		{
			validator: function() true,
			completer: function(context) [
				['mplayer', 'mplayer'],
				['mpg321', 'mpg321'],
				['mpg123', 'mpg123']
			]
		}
	);
}

options.add(["dict-hasaudio", "dich"],
	"Audio support.",
	"boolean",
	dict.isWin() ? false : true
);

options.add(['dict-simple', 'dics'],
	"Simple Output",
	"boolean",
	true
);

options.add(['dict-engine', 'dice'],
	'Dict engine',
	'string',
	'dict_cn',
	{
		completer: function(context) [
			['dict_cn', 'Dict.cn 海词'],
			['google', 'Google Translate']
		]
	}
);

group.commands.add(["di[ct]", "dic"],
	"Dict Lookup",
	dict.init,
	// dictBaidu,
	{
		argCount: "*",
		// http://stackoverflow.com/questions/1203074/firefox-extension-multiple-xmlhttprequest-calls-per-page/1203155#1203155
		// http://code.google.com/p/dactyl/issues/detail?id=514#c2
		completer: function (context, args) dict.suggest(dict.makeRequest(context, args), context),
		bang: true,
		options: []
	}
);

group.mappings.add([modes.NORMAL, modes.VISUAL],
	//["<Leader>z"],
	["<A-d>"],
	"Dict Lookup",
	function() {ex.dict();},
	{

	}
);

// dict! dict.cn 的模糊查询　或者是反转google的搜索设定 或者是返回全部的词典信息 ret['complex']
// * 返回查询的页面链接，最好可点击
// http://dict.cn/ws.php?utf8=true&q=%E4%BD%A0%E5%A5%BD rel tags
// FORCE_SINGLELINE | APPEND_MESSAGES
// 使用mozilla notification box?
// * clear previous active request
// cache or history
// - sound is broken out? linux/winxp/win7 okay
// auto completion doesn't work when you've never open dict.cn web page. --cookie
