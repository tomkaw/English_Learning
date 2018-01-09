$(function () {
    //////// 変数定義 ////////
    // 通信用変数
    var data_username, data_score, data_peerID, data_displayname;	// 接続, 自分の名前, 自分のスコア
    var conn_master, conn_1, conn_2, conn_3, peerID_master, peerID_1 = 'default', peerID_2 = 'default', peerID_3 = 'default';
    var token_btnDisabled = 1, token_style = '', token_waitOtherStudent = 0, token_start = 0;
    // iframe用変数
    var iframe_url; // URL

    // 学習用変数
    var learnValue_order = 0;  // 自分の順番, 人数
    var learnValue_flow = 0, learnValue_progress = 0, learnValue_mistake = 0; // 全体の解答回数, 全体の正解回数, 失敗回数
    var learnValue_timer = 0, setTimeout_timer; // ループ処理用変数, 関数
    // バランス調整用
    var define_timerLimit = 20, define_mistakeLimit = 3, define_countBeforeStart = 5;

    var tmp_restart = 0;
    var tmp_change = 0;

    // 学習用配列
    var array_question = new Array();       // 問題の全データ
    var array_strings = new Array();        // 問題の英文を分割
    var array_partnerKey = new Array();     // 共同学習者のピアID
    var array_skippedUser = new Array();    // 切断した共同学習者
    var array_connection = new Array();

    var audioElement = $('#speech_audio');
    var seElement = $('#id_se1');

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
            data_peerID = peer.id;
            FunctionIframe();
        }
    });

    //////// 自身のデータを取得、管理者のピアIDを取得、管理者に接続 ////////
    function FunctionIframe() {
        getCourseURL()
            .then(function (url) {
                iframe_url = url;
                injectIframe(url)
                    .then(GetName)
                    .then(function (name) {
                        data_username = name;
                        data_displayname = name.substring(name.indexOf(" ") + 1, name.length);
                    })
                    .then(function () {
                        return GetURL(iframe_url, 'DB_REGIST', 'view');
                    })
                    .then(injectIframe)
                    .then(GetRegistedData)
                    .then(function (userData) {
                        peerID_master = userData[0]['peerID'];
                        return GetURL(iframe_url, 'DB_USER', 'view');
                    })
                    .then(injectIframe)
                    .then(ChangeSort)
                    .then(function () {
                        return GetURL(iframe_url, 'DB_USER', 'view');
                    })
                    .then(injectIframe)
                    .then(function (iframe) {
                        return GetUserData(iframe, data_username);
                    })
                    .then(function (data) {
                        if (data['name'] == undefined || data['score'] == undefined) {
                            data_score = 500;
                            conn_master = peer.connect(peerID_master, {
                                metadata: {
                                    'name': data_username,
                                    'score': data_score,
                                    'token': 1
                                }
                            });
                        } else {
                            data_score = data['score'];
                        }
                    })
                    .then(function () {
                        Peer4Master(peerID_master);
                    })
                    .then(function () {
                        // 画面表示
                        $('#mydata').removeClass('hidden');
                        $('#mydata_name').text(data_displayname + ' (' + peer.id + ')');
                        $('#mydata_score').text(data_score);
                        $('#wrapper_expo').removeClass('hidden');
                        $('#expo_limit').text('制限時間（' + (define_timerLimit) + '秒）を超えてしまうと相手の番になります');
                        $('#expo').addClass('hidden');
                    });
            });
    }

    //////// 管理者に接続 ////////
    function Peer4Master(peerID) {
        //peerID_master = peerID;
        conn_master = peer.connect(peerID, {
            metadata: {
                'name': data_username,
                'score': data_score,
                'token': 0
            }
        });
    }

    ////////// P2P接続のリクエストを受けた場合の処理 //////////
    peer.on('connection', function (conn) {
        console.log(conn.peer);
        if (conn.peer === peerID_master) {
            // 学習用のデータを保存
            P4MgetLearnData(conn.metadata)
                .then(function (question) {
                    array_strings = question.split(" ");
                    stragePeerID();
                })
                .then(function () {
                    // 問題関連データを画面に表示
                    DisplayString();
                    getSoundData();
                })
                .then(function () {
                    // 学習者同士での通信
                    conn_master.on('data', operateScore);
                    Peer4Student();
                });
        } else {
            waitGetStudent();
            P4SgetPeerData(conn)
                .then(function () {
                    token_waitOtherStudent++;
                    if (token_waitOtherStudent >= array_partnerKey.length - 1) {
                        console.log('Peer ID: '+peerID_1);
                        startCountdown();
                    }
                });
        }
        conn.on('close', function () {
            console.log(conn.peer);
            if (conn.peer != peerID_master && array_strings.length > learnValue_progress) {
                var disconnectedmessage = timestamp() + conn.metadata.username + ' (' + conn.peer + ') さんとの通信が切断されました';
                $('#ELmessage').prepend('<ul>' + disconnectedmessage + '</ul>');
                // 残り3人、2人の場合
                array_skippedUser.push(conn.metadata.flag);
                if (conn.peer == peerID_1) {
                    peerID_1 = 'default';
                }
                if (conn.peer == peerID_2) {
                    peerID_2 = 'default';
                }
                if (conn.peer == peerID_3) {
                    peerID_3 = 'default';
                }
                // 学習順番の再検討
                if (learnValue_flow % array_partnerKey.length == conn.metadata.flag) {
                    skippedUserCheck();
                }
                if (token_start != 0) {
                    if (learnValue_flow % array_partnerKey.length == learnValue_order) {
                        func_order(0);
                    }
                }
            }
        });
        conn.on('error', function (error) {
            alert(error);
            console.log(error);
        });
    });

    function P4MgetLearnData(metadata) {
        return new Promise(function (resolve, reject) {
            learnValue_order = parseInt(metadata.order);
            array_question = $.extend(true, [], metadata.question);
            array_partnerKey = $.extend(true, [], metadata.partnerKEYs);
            $('#questionstring').removeClass('hidden');
            $('#token_sound').removeClass('hidden');
            resolve(array_question[1]);
        });
    }

    function stragePeerID() {
        return new Promise(function (resolve, reject) {
            for (var i in array_partnerKey) {
                if (array_partnerKey[i] != data_peerID) {
                    if (peerID_1 == 'default' || peerID_1 == undefined) {
                        peerID_1 = array_partnerKey[i];
                        console.log('conn1');
                    } else if (peerID_2 == 'default' || peerID_2 == undefined) {
                        peerID_2 = array_partnerKey[i];
                        console.log('conn2');
                    } else {
                        peerID_3 = array_partnerKey[i];
                        console.log('conn3');
                    }
                }
            }
            resolve(1);
        });
    }

    function P4SgetPeerData(conn) {
        return new Promise(function (resolve, reject) {
            // 送信されたPeer接続の中身をそのまま格納
            if (conn.peer == peerID_1) {
                console.log('receive p1');
                conn_1 = conn;
                conn_1.on('data', handleMessage);
                console.log('Connection1 :'+ conn_1);
            } else if (conn.peer == peerID_2) {
                console.log('receive p2');
                conn_2 = conn;
                conn_2.on('data', handleMessage);
            } else if (conn.peer == peerID_3) {
                console.log('receive p3');
                conn_3 = conn;
                conn_3.on('data', handleMessage);
            }
            $('#partnerdata').removeClass('hidden');
            $('#partnerdata_name').append(conn.metadata.username + ' ');
            resolve(1);
        });
    }

    function waitGetStudent() {
        var nestCount_wgs = function () {
            console.log("waiting connect to master.");
            var tmp_wgs = setTimeout(nestCount_wgs, 1000);
            if (array_partnerKey.length != 0) {
                clearTimeout(tmp_wgs);
            }
        }
        nestCount_wgs();
    }

    function startCountdown() {
        var tmp_countdown = 0;
        var nestCount = function () {
            if (learnValue_order != learnValue_flow) {
                $('#order_latest').css('color', 'black');
                $('#order_latest').text("現在、あなたは解答者ではありません");
            } else {
                $('#order_latest').css('color', 'blue');
                $('#order_latest').text("現在、あなたは解答者です");
            }
            $('#questiontimer_value').text(define_countBeforeStart - tmp_countdown);
            tmp_countdown++;
            var tmp_scd = setTimeout(nestCount, 1000);
            if (define_countBeforeStart - tmp_countdown < 0) {
                clearTimeout(tmp_scd);
                learningStart();
            }
        }
        $('#loading').addClass('hidden');
        $('#wrapper_order').removeClass('hidden');
        //$('#order').removeClass('hidden');
        $('#wrapper-message').removeClass('hidden');
        //$('#questiontimer').removeClass('hidden');
        nestCount();
    }

    function learningStart() {
        skippedUserCheck()
            .then(function () {
                token_start = 1;
                $('#ELtext').removeClass('hidden');
            })
            .then(function () {
                if (learnValue_order != learnValue_flow) {
                    $('#order_latest').css('color', 'black');
                    $('#order_latest').text("現在、あなたは解答者ではありません");
                    $('#send-message').prop('disabled', true);
                    displayTimer();
                } else {
                    $('#order_latest').css('color', 'blue');
                    $('#order_latest').text("現在、あなたは解答者です");
                    $('#send-message').prop('disabled', false);
                    token_btnDisabled = 0;
                    countdown_timer()
                    //setTimeout(countdown_timer(), 1000);
                }
            });
    }

    function skippedUserCheck() {
        return new Promise(function (resolve, reject) {
            for (var i = 0; i < array_skippedUser.length; i++) {
                if (learnValue_flow % array_partnerKey.length == array_skippedUser[i]) {
                    i = -1;
                    learnValue_flow++;
                }
            }
            resolve(1);
        });
    }

    ////////// 共同学習者に接続 //////////
    function Peer4Student() {
        conn_1 = peer.connect(peerID_1, {
            metadata: {
                'flag': learnValue_order,
                'username': data_displayname
            }
        });
        conn_1.on('data', handleMessage);
        if (peerID_2 != 'default') {
            conn_2 = peer.connect(peerID_2, {
                metadata: {
                    'flag': learnValue_order,
                    'username': data_displayname
                }
            });
            conn_2.on('data', handleMessage);
        }
        if (peerID_3 != 'default') {
            conn_3 = peer.connect(peerID_3, {
                metadata: {
                    'flag': learnValue_order,
                    'username': data_displayname
                }
            });
            conn_3.on('data', handleMessage);
        }
    }

    //////////  //////////
    function DisplayString() {
        return new Promise(function (resolve, reject) {
            $('#questionstring_value').text('');
            for (var i = 0; i < learnValue_progress; i++) {
                $('#questionstring_value').append(array_strings[i]);
                $('#questionstring_value').append(' ');
            }
            for (i = learnValue_progress; i < array_strings.length; i++) {
                for (var j = 0; j < array_strings[i].length; j++) {
                    $('#questionstring_value').append("*");
                }
                $('#questionstring_value').append(' ');
            }
            resolve(1);
        });
    }

    // メッセージの受信
    function handleMessage(data) {
        var displayJudge = '';
        if (processString(array_strings[learnValue_progress]) === processString(data.text)) {
            learnValue_mistake = 0;
            learnValue_progress = advanceLearning(learnValue_progress);
        } else {
            displayJudge = '不';
            learnValue_mistake++;
            if (learnValue_mistake >= define_mistakeLimit) {
                learnValue_mistake = 0;
                learnValue_progress = advanceLearning(learnValue_progress);
            }
        }

        learnValue_flow++;
        skippedUserCheck();
        if (array_strings.length <= learnValue_progress) {
            func_order(2);
        } else if (learnValue_flow % array_partnerKey.length == learnValue_order) {
            func_order(0);
        } else {
            func_order(1);
        }

        var answereduser;
        if (data.peerid == data_peerID) { answereduser = 'あなた'; token_style = 'blue' }
        else { answereduser = '学習パートナー'; token_style = 'black' }
        if (data.time == 0) { var displayMessage = timestamp() + answereduser + ' が' + displayJudge + '正解の英単語 ' + data.text + ' を入力しました'; }
        else { var displayMessage = timestamp() + answereduser + ' が時間切れになりました' }
        $('#ELmessage').prepend('<ul><span style=\"color: ' + token_style + ';\">' + displayMessage + '</span></ul>');
        //$('#display-message').append(displayMessage);

        DisplayString();
    }

    function countdown_timer() {
        clearTimeout(setTimeout_timer);
        learnValue_timer = 0;
        seElement[0].play();
        var funcCount_timer = function () {
            displayTimer();
            learnValue_timer++;
            setTimeout_timer = setTimeout(funcCount_timer, 1000);
            if (learnValue_timer > define_timerLimit) {
                clearTimeout(setTimeout_timer);
                sendMessage(1);
            }
        }
        funcCount_timer();
    }

    function displayTimer() {
        $('#questiontimer_value').text('残り時間 (' + ('000' + (define_timerLimit - learnValue_timer)).slice(-2) + '秒):');
        for (var i = 0; i < learnValue_timer; i++) {
            $('#questiontimer_value').append('□');
        }
        for (var j = learnValue_timer; j < define_timerLimit; j++) {
            $('#questiontimer_value').append('■');
        }
    }

    function advanceLearning(progress) {
        var tmp_progress = progress;
        var reg = new RegExp(/^[!"#$%&'()\*\+\-\.,\/:;<=>?@\[\\\]^_`{|}~]$/);
        tmp_progress++;
        while (reg.test(array_strings[tmp_progress])) {
            tmp_progress++;
        }
        return tmp_progress;
    }

    // メッセージの送信
    function sendMessage(timelimit) {
        clearTimeout(setTimeout_timer);
        sendMessage_getText()
            .then(function (text) {
                // 入力文字列name、textを取得
                var data = { 'from': data_username, 'text': text, 'time': timelimit, 'peerid': data_peerID };
                return data;
            })
            .then(function (data) {
                // 接続connを使って送信
                if (peerID_1 != 'default') {
                    console.log('send1');
                    conn_1.send(data);
                }
                if (peerID_2 != 'default') {
                    console.log('send2');
                    conn_2.send(data);
                }
                if (peerID_3 != 'default') {
                    console.log('send3');
                    conn_3.send(data);
                }
                // メッセージを受け取り表示する関数
                handleMessage(data);
                // 入力文字列textを初期化
                $('#message').val('');
            });
    }

    function sendMessage_getText() {
        return new Promise(function (resolve, reject) {
            // HTMLのid=sendmessageボタンをクリックすると実行
            var text = $('#message').val();
            if (processString(text) == processString(array_strings[learnValue_progress])) {
                var tmp_addScore = 5;
                switch (learnValue_mistake) {
                    case 0:
                        tmp_addScore += Math.floor((define_timerLimit - learnValue_timer) / 2);    
                        break;
                    case 1:
                        tmp_addScore += Math.floor((define_timerLimit - learnValue_timer) / 4);
                        break;
                    default:
                        break;    
                }
                operateScore(tmp_addScore);
            } else {
                operateScore(-5);
            }
            resolve(text);
        });
    }

    function processString(value) {
        var tmp_string = value.toLowerCase();
        tmp_string = tmp_string.replace(/[!"#$%&'()\*\+\-\.,\/:;<=>?@\[\\\]^_`{|}~]/g, "");
        return tmp_string;
    }

    // スペースキーで音声再生+半角スペースの除去
    $('#message').keyup(function (e) {
        var tmptxt = $('#message').val();
        tmptxt = tmptxt.replace(/ /g, "");
        $('#message').val(tmptxt);
    });

    // メッセージの送信はキーコード13（エンターキー）を入力することで実行される
    $('#message').keypress(function (e) {
        if (e.which == 13) {
            if ($('#message').val() != null && $('#message').val() != "" && token_btnDisabled == 0) {
                sendMessage(0);
            }
        } else if (e.which == 32) {
            audioElement[0].play();
        }
    });
    // HTMLのボタンsend-messageをクリックすることでも実行される
    $('#send-message').click(function () {
        if ($('#message').val() != null && $('#message').val() != "") {
            sendMessage(0);
        }
    });

    $('#change-expo').click(function () {
        if (tmp_change == 0) {
            $('#expo').removeClass('hidden');
            $('#change-expo').text('説明を非表示');
            tmp_change = 1;
        } else {
            $('#expo').addClass('hidden');
            $('#change-expo').text('説明を表示');
            tmp_change = 0;
        }
    });

    function getSoundData() {
        return new Promise(function (resolve, reject) {
            var url = "https://rawgit.com/tomkaw/English_Learning/master/resource/" + array_question[0] + ".mp3";
            // 再生ファイルの設定
            audioElement[0].src = url;
            // 音声の再生
            audioElement[0].play();
            resolve(1);
        });
    }

    function func_order(val) {
        if (val == 0) {
            $('#order_latest').css('color', 'blue');
            $('#order_latest').text("現在、あなたは解答者です");
            $('#send-message').prop('disabled', false);
            token_btnDisabled = 0;
            countdown_timer();
        } else if (val == 1) {
            $('#order_latest').css('color', 'black');
            $('#order_latest').text("現在、あなたは解答者ではありません");
            $('#send-message').prop('disabled', true);
            token_btnDisabled = 1;
        } else {
            $('#order_latest').css('color', 'black');
            $('#order_latest').text("学習は終了しました");
            $('#order_latest').append("<button id='send-restart'>もう一度</button>");
            $('#questionstring_translation').text(array_question[2]);
            $('#send-message').prop('disabled', true);
            token_btnDisabled = 1;
        }
    }

    function timestamp() {
        var now = new Date();
        var year = now.getYear();   // 年
        var month = now.getMonth() + 1; // 月
        var day = now.getDate();    // 日
        var hour = now.getHours();  // 時
        var min = now.getMinutes(); // 分
        var sec = now.getSeconds(); // 秒

        if (year < 2000) { year += 1900; }
        if (month < 10) { month = "0" + month; }
        if (day < 10) { day = "0" + day; }
        if (hour < 10) { hour = "0" + hour; }
        if (min < 10) { min = "0" + min; }
        if (sec < 10) { sec = "0" + sec; }

        return '[' + year + '\/' + month + '\/' + day + ' ' + hour + ':' + min + ':' + sec + ']';
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

    function operateScore(value) {
        // スコアを変更
        data_score = parseInt(data_score) + value;
        // 表示スコアの更新
        $('#mydata_score').text(data_score);
        // 管理者へ送信する学習進捗の設定
        var tmp_progress = learnValue_progress;
        if (value > 0 || learnValue_mistake >= 2) {
            tmp_progress = advanceLearning(tmp_progress);
        }
        // 管理者へ送信
        var data = { 'name': data_username, 'score': data_score, 'progress': tmp_progress };
        conn_master.send(data);
    }

    $(document).on('click', '#send-restart', function () {
        restart();
    });

    function restart() {
        $('#partnerdata_name').text('');
        //$('#order_latest').text("Waiting...");
        conn_1.close();
        if(conn_2) conn_2.close();
        if(conn_3) conn_3.close();
        conn_1 = void 0; conn_2 = void 0; conn_3 = void 0; conn_master = void 0; peerID_1 = 'default'; peerID_2 = 'default'; peerID_3 = 'default';
        token_waitOtherStudent = 0; token_start = 0
        learnValue_order = 0;
        learnValue_flow = 0; learnValue_progress = 0; learnValue_mistake = 0;
        array_question.length = 0;
        array_strings.length = 0;
        array_partnerKey.length = 0;
        array_skippedUser.length = 0;
        array_connection.length = 0;

        $('#questionstring_translation').text('');

        $('#partnerdata').addClass('hidden');
        $('#wrapper_order').removeClass('hidden');
        //$('#order').addClass('hidden');
        //$('#questiontimer').addClass('hidden');
        $('#token_sound').addClass('hidden');
        $('#ELtext').addClass('hidden');
        $('#questionstring').addClass('hidden');
        $('#loading').removeClass('hidden');
        Peer4Master(peerID_master);
    }

});