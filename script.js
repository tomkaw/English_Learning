$(function () {
    //////// 変数定義 ////////
    // 通信用変数
    var conn, user_name, user_score, myPeerID;	// 接続, 自分の名前, 自分のスコア
    var conn1, conn2, conn3, peerID1, peerID2, peerID3, masterPeerID;
    // iframe用変数
    var iframe_url; // URL

    // 学習用変数
    var learn_order, learn_number;  // 自分の順番, 人数
    var learn_flow = 0, learn_progress = 0, learn_mistake = 0; // 全体の解答回数, 全体の正解回数, 失敗回数
    var learn_timer = 0, sTo_time; // ループ処理用変数, 関数
    // バランス調整用
    var learn_timer_limit = 16, mistakeBorder = 3

    // 学習用配列
    var array_question = new Array();   // 問題の全データ
    var array_strings = new Array();    // 問題の英文を分割
    var array_partnerKey = new Array();

    var array_skippedUser = new Array();

    var audioElement = $('#speech_audio');

    //////// PeerJS初期設定 ////////
    // 新規PeerJSインスタンス
    var peer = new Peer({
        // APIキー
        key: '900d7a23-6264-4afe-8896-15f0d020ca61',
        turn: false,
        //デバッグモードの冗長性
        debug: 3,
        // ICEサーバ
        config: {
            'iceServers': [
                { url: 'stun:stun1.l.google.com:19302' },
                {
                    url: 'turn:numb.viagenie.ca',
                    credential: 'muazkh', username: 'webrtc@live.com'
                }]
        }
    });

    // 使用ブラウザを返す
    navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

    // インスタンス作成に成功すると処理が開始される
    peer.on('open', function () {
        if (peer.id == null) {
            alert("Connection is closed.");
        } else {
            myPeerID = peer.id;
            //GetTSV();
            FunctionIframe();
        }
    });

    //////// 自身のデータを取得、管理者のピアIDを取得、管理者に接続 ////////
    function FunctionIframe() {
        getCourseURL()
            .then(function (url) {
                iframe_url = url;
                injectIframe(iframe_url)
                    .then(GetName)
                    .then(function (name) {
                        user_name = name;
                        return GetURL(iframe_url, 'DB_USER', 'view');
                    })
                    .then(injectIframe)
                    .then(ChangeSort)
            })
            .then(function () {
                return GetURL(iframe_url, 'DB_USER', 'view');
            })
            .then(injectIframe)
            .then(function (iframe) {
                return GetUserData(iframe, user_name);
            })
            .then(function (mydata) {
                if (mydata['name'] == undefined || mydata['score'] == undefined) {
                    // 自身の学習者情報が登録されていなかった場合
                    user_score = 1000;
                    // データの登録
                    GetURL(iframe_url, 'DB_USER', 'edit')
                        .then(injectIframe)
                        .then(function (iframe) {
                            RegistUserData(iframe, user_name, user_score);
                        });
                } else {
                    // 登録されていた場合
                    user_score = mydata['score'];
                }
                // 画面表示
                $('#myData').removeClass('hidden');
                $('#token_user_name').text(user_name + ' ' + peer.id);
                $('#token_user_score').text(user_score);
            })
            .then(function () {
                return GetURL(iframe_url, 'DB_REGIST', 'view');
            })
            .then(injectIframe)
            .then(function (iframe) {
                return GetRegistedData(iframe);
            })
            .then(function (userData) {
                Peer4Master(userData[0]['peerID']);
            })
    }

    //////// 管理者に接続 ////////
    function Peer4Master(peerID) {
        masterPeerID = peerID;
        conn = peer.connect(peerID, {
            metadata: {
                'score': user_score
            }
        });
    }

    ////////// P2P接続のリクエストを受けた場合の処理 //////////
    peer.on('connection', function (connection) {
        console.log(connection.metadata);
        if (connection.peer == masterPeerID) {
            // 学習用のデータを保存
            learn_order = parseInt(connection.metadata.order);
            array_question = $.extend(true, [], connection.metadata.question)
            array_strings = array_question[1].split(" ");
            array_partnerKey = $.extend(true, [], connection.metadata.partnerKEYs);
            // 問題関連データを画面に表示
            $('#questiondata').removeClass('hidden');
            //$('#token_question').text(array_question[0]);
            $('#questionstring').removeClass('hidden');
            $('#token_sound').removeClass('hidden');
            DisplayString();
            polly_create();
            //$('#token_sound').html("<audio id='sentence' controls='controls' preload='auto'>can't play...<source src='https://rawgit.com/tomkaw/English_Learning/master/resource/" + array_question[0] + ".mp3' type='audio/mp3'>");
            // 学習者同士での通信
            Peer4Student();
        } else {
            $('#partnerdata').removeClass('hidden');
            // 送信されたPeer接続の中身をそのまま格納
            if (connection.peer == peerID1) {
                console.log('receive p1');
                conn1 = connection;
                conn1.on('data', handleMessage);
            } else if (connection.peer == peerID2) {
                console.log('receive p2');
                conn2 = connection;
                conn2.on('data', handleMessage);
            } else if (connection.peer == peerID3) {
                console.log('receive p3');
                conn3 = connection;
                conn3.on('data', handleMessage);
            }

            $('#token_partner_name').append(connection.metadata.username + ' ');

            $('#chat').removeClass('hidden');
            if (learn_order != 0) {
                $('#send-message').prop('disabled', true);
                displayTimer();
            } else {
                setTimeout(timer1(), 1000);
            }
            $('#loading').addClass('hidden');
            $('#questiontimer').removeClass('hidden');
        }
        connection.on('close', function () {
            if (connection.peer != masterPeerID) {
                $('#messages').text('Disconnected from ' + connection.metadata.username + ' (' + connection.peer + ')');
                // 残り3人、2人の場合
                array_skippedUser.push(connection.metadata.flag);
                array_skippedUser.sort(function (a, b) {
                    return a - b;
                });
                console.log(array_skippedUser);
                if (conn1) {
                    if (connection.peer == conn1.peer) {
                        conn1 = void 0;
                    }
                } else if (conn2) {
                    if (connection.peer == conn2.peer) {
                        conn2 = void 0;
                    }
                } else if (conn3) {
                    if (connection.peer == conn3.peer) {
                        conn3 = void 0;
                    }
                }
                // 学習順番の再検討
                if (learn_flow % array_partnerKey.length == connection.metadata.flag) { }
                skippedUserCheck();
                if (learn_flow % array_partnerKey.length == learn_order) {
                    $('#send-message').prop('disabled', false);
                    learn_timer = 0;
                    timer1();
                }
            }
        });
        connection.on('error', function (error) {
            alert(error);
            console.log(error);
        });
    });

    function skippedUserCheck() {
        for (var i = 0; i < array_skippedUser.length; i++) {
            console.log(learn_flow + ':' + array_skippedUser[i]);
            if (learn_flow % array_partnerKey.length == array_skippedUser[i]) {
                i = -1;
                learn_flow++;
            }
        }
    }

    ////////// 共同学習者に接続 //////////
    function Peer4Student() {
        for (var i in array_partnerKey) {
            if (array_partnerKey[i] != myPeerID) {
                if (conn1 == undefined) {
                    peerID1 = array_partnerKey[i];
                    conn1 = peer.connect(array_partnerKey[i], {
                        metadata: {
                            'flag': learn_order,
                            'username': user_name
                        }
                    });
                    conn1.on('data', handleMessage);
                } else if (conn2 == undefined) {
                    peerID2 = array_partnerKey[i];
                    conn2 = peer.connect(array_partnerKey[i], {
                        metadata: {
                            'flag': learn_order,
                            'username': user_name
                        }
                    });
                    conn2.on('data', handleMessage);
                } else {
                    peerID3 = array_partnerKey[i];
                    conn3 = peer.connect(array_partnerKey[i], {
                        metadata: {
                            'flag': learn_order,
                            'username': user_name
                        }
                    });
                    conn3.on('data', handleMessage);
                }
            }
        }
    }

    //////// iframe関数 ////////
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
                        r.push(e.href);
                    }
                    return r;
                }, [])[0];
                removeElement(iframe);
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

    function RegistUserData(iframe, name, score) {
        var ary_data = [score, name];
        var doc = iframe.contentDocument;
        var form = Array.prototype.reduce.call(doc.forms, function (r, e) {
            if (("" + e.action).match(/edit.php/)) r.push(e);
            return r;
        }, [])[0];
        for (key in form) {
            if (isNaN(key) == false && form[key].id.match(/field_/)) {
                form[form[key].id].value = ary_data.pop();
            }
        }
        return new Promise(function (resolve, reject) {
            iframe.onload = function (e) {
                resolve(iframe);
            }
            setTimeout(function () {
                //reject("submitNewdiscussion: timeout: over " + injectIframe.timeout + "ms: " + + iframe.src + ": " + form.action);
            }, injectIframe.timeout);
            form.submit();
        });
    }

    function GetUserData(iframe, name) {
        reg = new RegExp('^name:' + name);
        return new Promise(function (resolve) {
            var doc = iframe.contentDocument;
            var list_div = doc.getElementsByTagName('div');
            var entry = new Array();
            for (item_div of list_div) {
                if (item_div.textContent.match(reg)) {
                    fields = item_div.textContent.split(';')
                    entry['name'] = fields[0].split(':')[1]
                    entry['score'] = fields[1].split(':')[1]
                }
            }
            resolve(entry);
        });
    }

    function GetRegistedData(iframe) {
        //reg = new RegExp('^RoomID\:'+roomid);
        reg = new RegExp('^name\:');
        return new Promise(function (resolve) {
            var doc = iframe.contentDocument;
            var list_div = doc.getElementsByTagName('div');
            //var entry = new Array();
            var entries = new Array();
            var loop = 0;
            for (item_div of list_div) {
                if (item_div.textContent.match(reg)) {
                    fields = item_div.textContent.split(';');
                    entries[loop] = new Array();
                    entries[loop]['name'] = fields[0].split(':')[1];
                    entries[loop]['score'] = fields[1].split(':')[1];
                    entries[loop]['peerID'] = fields[2].split(':')[1];
                    loop++;
                }
            }
            resolve(entries);
        });
    }

    function ChangeMyData(iframe) {
        return new Promise(function (resolve) {
            var doc = iframe.contentDocument;
            var list_a = doc.getElementsByTagName('a');
            for (item_a of list_a) {
                if (item_a.href.match(/rid\=/)) {
                    injectIframe(item_a.href)
                        .then(function (iframe2) {
                            EditAct(iframe2);
                        });
                }
            }
        });
    }

    function EditAct(iframe) {
        var ary_data = [user_score, user_name];
        var doc = iframe.contentDocument;
        var form = Array.prototype.reduce.call(doc.forms, function (r, e) {
            if (("" + e.action).match(/edit.php/)) r.push(e);
            return r;
        }, [])[0];
        for (key in form) {
            if (isNaN(key) == false && form[key].id.match(/field_/)) {
                form[form[key].id].value = ary_data.pop();
            }
        }
        return new Promise(function (resolve, reject) {
            iframe.onload = function (e) {
                resolve(iframe);
            }
            setTimeout(function () {
                //reject("submitNewdiscussion: timeout: over " + injectIframe.timeout + "ms: " + + iframe.src + ": " + form.action);
            }, injectIframe.timeout);
            form.submit();
        });
    }

    function operateScore(value) {
        user_score = parseInt(user_score) + value;
        $('#token_user_score').text(user_score);
        GetURL(iframe_url, 'DB_USER', 'view')
            .then(injectIframe)
            .then(ChangeMyData)
    }

    //////////  //////////

    function DisplayString() {
        $('#questionstring').text('');
        for (var i = 0; i < learn_progress; i++) {
            $('#questionstring').append(array_strings[i]);
            $('#questionstring').append(' ');
        }
        for (i = learn_progress; i < array_strings.length; i++) {
            for (var j = 0; j < array_strings[i].length; j++) {
                $('#questionstring').append("*");
            }
            $('#questionstring').append(' ');
        }
    }

    // メッセージの受信
    function handleMessage(data) {
        var displayJudge = 'Right!';
        var sended = array_strings[learn_progress].toLowerCase();
        sended = sended.replace(/[!"#$%&'()\*\+\-\.,\/:;<=>?@\[\\\]^_`{|}~]/g, "");
        var answer = data.text.toLowerCase();
        answer = answer.replace(/[!"#$%&'()\*\+\-\.,\/:;<=>?@\[\\\]^_`{|}~]/g, "");
        if (sended == answer) {
            advanceLearning();
        } else {
            displayJudge = 'Miss!';
            learn_mistake++;
            if (learn_mistake >= mistakeBorder) {
                advanceLearning();
            }
        }

        learn_flow++;
        skippedUserCheck();
        if (array_strings.length <= learn_progress) {
            $('#send-message').prop('disabled', true);
        } else if (learn_flow % array_partnerKey.length == learn_order) {
            $('#send-message').prop('disabled', false);
            learn_timer = 0;
            timer1();
        } else {
            $('#send-message').prop('disabled', true);
        }

        var displayMessage = data.from + '\'s answer : ' + data.text + '. It\'s ' + displayJudge;
        $('#messages').text(displayMessage);

        DisplayString();
    }

    function timer1() {
        clearTimeout(sTo_time);
        timer2();
    }

    function timer2() {
        console.log('timer:' + learn_timer);
        displayTimer();
        learn_timer++
        sTo_time = setTimeout(timer2, 1000);
        if (learn_timer >= learn_timer_limit) {
            clearTimeout(sTo_time);
            sendMessage();
        }
    }

    function displayTimer() {
        $('#token_timer').text('');
        for (var i = 0; i < learn_timer; i++) {
            $('#token_timer').append('|');
        }
        for (var j = learn_timer; j < learn_timer_limit - 1; j++) {
            $('#token_timer').append('_');
        }
    }

    function advanceLearning() {
        learn_mistake = 0;
        var reg = new RegExp(/^[!"#$%&'()\*\+\-\.,\/:;<=>?@\[\\\]^_`{|}~]$/);
        learn_progress++;
        while (reg.test(array_strings[learn_progress])) {
            learn_progress++;
        }
    }

    // メッセージの送信
    function sendMessage() {
        clearTimeout(sTo_time);
        // HTMLのid=sendmessageボタンをクリックすると実行
        var text = $('#message').val();
        // 入力文字列name、textを取得
        var data = { 'from': user_name, 'text': text };
        if (data.text == array_strings[learn_progress]) {
            operateScore(5);
        } else {
            operateScore(-5);
        }
        // 接続connを使って送信
        if (conn1 != undefined) {
            console.log('send1');
            conn1.send(data);
        }
        if (conn2 != undefined) {
            console.log('send2');
            conn2.send(data);
        }
        if (conn3 != undefined) {
            console.log('send3');
            conn3.send(data);
        }
        // メッセージを受け取り表示する関数
        handleMessage(data);
        // 入力文字列textを初期化
        $('#message').val('');
    }

    // メッセージの送信はキーコード13（エンターキー）を入力することで実行される
    $('#message').keypress(function (e) {
        if (e.which == 13) {
            if ($('#message').val() != null && $('#message').val() != "") {
                sendMessage();
            }
        } else if (e.which == 32) {
            audioElement[0].play();
            var tmptxt = $('#message').val();
            tmptxt = tmptxt.replace(/ /g, "");
            $('#message').val(tmptxt);
        }
    });
    // HTMLのボタンsend-messageをクリックすることでも実行される
    $('#send-message').click(function () {
        if ($('#message').val() != null && $('#message').val() != "") {
            sendMessage();
        }
    });

    //////// Amazon Polly ////////
    function polly_create() {
        var url = "https://rawgit.com/tomkaw/English_Learning/master/resource/" + array_question[0] + ".mp3";
        // 再生ファイルの設定
        audioElement[0].src = url;
        // 音声の再生
        audioElement[0].play();
    }

    //$('#play_sound').click(function () {
    //    audioElement[0].play();
    //});

});