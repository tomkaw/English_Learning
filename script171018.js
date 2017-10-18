$(function () {
    // 変数定義
    var peer_id, conn;	// ピアID、接続
    var user_name, user_score;  // 自分の名前、スコア
    // 配列定義
    var messages = [];	// メッセージを格納
    // iframe用変数
    var iframe_url;
    injectIframe.timeout = 10000;
    // チャット表示のテンプレート（handlerbars）
    var messages_template = Handlebars.compile($('#messages-template').html());

////// PeerJS初期設定 //////
    // 新規PeerJSインスタンス
    var peer = new Peer({
        // APIキー
        key: '3cbz326wgxlgnwmi',
        //デバッグモードの冗長性
        debug: 3,
        // ICEサーバ
        config: {
            'iceServers': [
            { url: 'stun:stun1.l.google.com:19302' },
            { url: 'turn:numb.viagenie.ca',
              credential: 'muazkh', username: 'webrtc@live.com' }]
        }
    });

    // 使用ブラウザを返す
    navigator.getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia;

    // インスタンス作成に成功すると実行される
    peer.on('open', function () {
        getCourseURL()    
            .then(function (url) {
                iframe_url = url;
                injectIframe(iframe_url)
                    .then(GetName)
                    .then(function (name) {
                        user_name = name;
                        console.log(user_name);
                        return GetURL(iframe_url, 'DB_USER', 'view');
                    })
            })
            .then(injectIframe)
            .then(ChangeSort)
            .then(function () {
                return GetURL(iframe_url, 'DB_USER', 'view');
            })
            .then(injectIframe)
            .then(function () {
                return GetUserData(iframe, user_name);
            })
            .then(function (mydata) {
                if (mydata['name'] == undefined || mydata['score'] == undefined) {
                    // 自身の学習者情報が登録されていなかった場合
                    user_score = 1500;
                    // データの登録
                //    GetURL(iframe_url, 'DB_USER', 'edit')
                //    .then(injectIframe)
                //    .then(function (iframe2) {
                //        RegistUserData(iframe2, token_user_name, token_user_score);
                //    });
                } else {
                    // 登録されていた場合
                    user_score = mydata['score'];
                }
                // 画面表示
                $('#token_user_name').text(user_name);
                $('#token_user_score').text(user_score);
                $('#myData').removeClass('hidden');
            })
    });

////// iframe関数 //////
    // Moodleのコース名を取得
    function getCourseURL() {
        return new Promise(function (resolve, reject) {
            if (!getCourseURL.cache) {
                var a = document.getElementsByClassName("breadcrumb")[0].getElementsByTagName("A");
                getCourseURL.cache = Array.prototype.reduce.call(a, function (r, e) {
                    if (e.href.match('course/view[.]php[?]id=([0-9]+)')) {
                        r.push(e.href);
                    }
                    return r;
                }, [])[0];
            }
            resolve(getCourseURL.cache);
        });
    }

    // iframe型オブジェクトを削除
    function removeElement(e) {
        e.parentNode.removeChild(e);
        return e;
    }

    // iframe型オブジェクトを作成
    function injectIframe(url) {
        return new Promise(function (resolve, reject) {
            var timeout = true;
            var iframe = document.createElement("IFRAME");
            iframe.style.display = "none";
            iframe.style.width = "100%";
            iframe.src = url;
            iframe.onload = function (e) {
                timeout = false;
                resolve(iframe);
            }
            setTimeout(function () {
                if (timeout) {
                    //reject("injectIframe: timeout: over " + injectIframe.timeout + "ms: " + url);
                }
            }, injectIframe.timeout);
            document.body.appendChild(iframe);
        });
    }

    function GetName(iframe) {
        return new Promise(function (resolve) {
            var doc = iframe.contentDocument;
            var list_a = doc.getElementsByTagName('a');
            var ary_data = [];
            for (item_a of list_a) {
                if (item_a.href.match('profile.php')) {
                    ary_data.push(item_a.textContent);
                }
            }
            resolve(ary_data.pop());
        });
    }

    function GetURL(course_url, pattern, page) {
        return new Promise(function (resolve, reject) {
            injectIframe(course_url).then(function (iframe) {
                var doc = iframe.contentDocument;
                var a = doc.getElementsByTagName("A");
                var href = Array.prototype.reduce.call(a, function (r, e) {
                    if (e.textContent.match(pattern)) {
                        console.log(e.textContent);
                        r.push(e.href);
                    }
                    return r;
                }, [])[0];
                removeElement(iframe);
                console.log("url_result:" + href);
                if (page === 'edit') {
                    href = href.replace(/view.php/g, "edit.php");
                }
                resolve(href);
            });
        });
    }

    // ソート条件の変更
    function ChangeSort(iframe) {
        var doc = iframe.contentDocument;
        var form = Array.prototype.reduce.call(doc.forms, function (r, e) {
            //if (("" + e.action).match(/view.php/)) r.push(e);
            if (("" + e.id).match(/options/)) r.push(e);
            return r;
        }, [])[0];
        for (key in form) {
            if (isNaN(key) == false && form[key].id.match(/pref_perpage/)) {
                form[key].value = 1000;
            } else if (isNaN(key) == false && form[key].id.match(/pref_order/)) {
                form[key].value = 'DESC';
            }
        }
        return new Promise(function (resolve, reject) {
            iframe.onload = function (e) {
                removeElement(iframe);
                resolve();
            }
            setTimeout(function () {
                //reject("submitNewdiscussion: timeout: over " + injectIframe.timeout + "ms: " + + iframe.src + ": " + form.action);
            }, injectIframe.timeout);
            form.submit();
        });
    }

    function GetUserData(iframe, name) {
        //console.log("name:"+name);
        reg = new RegExp('^name:' + name);
        return new Promise(function (resolve) {
            var doc = iframe.contentDocument;
            var list_div = doc.getElementsByTagName('div');
            var entry = new Array();
            for (item_div of list_div) {
                if (item_div.textContent.match(reg)) {
                    //console.log('data_header:\n'+item_div.textContent);
                    fields = item_div.textContent.split(';')
                    entry['name'] = fields[0].split(':')[1]
                    entry['score'] = fields[1].split(':')[1]
                }
            }
            resolve(entry);
        });
    }
});