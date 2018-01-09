$(function () {
    //////// 変数定義 ////////
    // PeerJS用変数
    var conn;
    // セレクトボックスの初期値
    var var_question = 0, var_selectbox = 2;
    // 配列定義
    var array_question = new Array();   // 問題情報を格納
    var array_entries = new Array();    // 待機学習者を格納
    var array_changeUser = new Array(); // スコアが更新される学習者を格納
    var array_teamAprogress = new Array();
    // 問題格納ファイル
    var TSVFILE = 'https://rawgit.com/tomkaw/English_Learning/master/resource/question.tsv';
    // Iframe用変数
    var iframe_url;
    // トークン
    var token_changeuser = 0; // スコア更新関数の管理

    var tmp_student = 0;
    var tmp_array_team = new Array();
    var tmp_last_question = new Array();

    ////// PeerJS初期設定 //////
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

    // インスタンス作成に成功すると実行される
    peer.on('open', function () {
        if (peer.id == null) {
            console.log("Connection is closed.")
        } else {
            GetTSV();
            IframeSetting();
        }
    });

    //////// 問題DBの読み込み ////////
    function GetTSV() {
        d3.tsv(TSVFILE, function (error, data) {
            $('#wrapper_learning').removeClass('hidden');
            var i = 0;
            for (var i in data) {
                array_question.push([('000' + i).slice(-3), data[i].String, data[i].Translation]);
                $("#select_question").append($("<option>").val(parseInt(i) + 1).text(parseInt(i) + 1));
            }
        });
    }

    //////// 管理者データの更新 ////////
    function IframeSetting() {
        getCourseURL()
            .then(function (url) {
                iframe_url = url;
                GetURL(iframe_url, 'DB_REGIST', 'view')
                    .then(injectIframe)
                    .then(function (iframe) {
                        ChangeInfo(iframe, peer.id);
                        $('#button_container').removeClass('hidden');
                        $('#registeduser').removeClass('hidden');
                        $('#token_registed').text(array_entries.length);
                    })
            })
    }

    //////// PeerJS ////////
    peer.on('connection', function (connection) {
        if (connection.metadata.token == 1) {
            // 学習者情報を追加する
            GetURL(iframe_url, 'DB_USER', 'edit')
                .then(injectIframe)
                .then(function (iframe) {
                    RegistUserData(iframe, connection.metadata.name, connection.metadata.score);
                });
        } else if (connection.metadata.token == 2) {
            //operateScore(connection.metadata);
        } else {
            console.log(connection.metadata.score);
            // 学習者のデータを配列に格納
            array_entries[array_entries.length] = [connection.metadata.name, connection.metadata.score, connection.peer];
            $('#token_registed').text(array_entries.length);
            changeStartBtn();
        }
        connection.on('data', operateScore);
        // 切断された時の処理
        connection.on('close', function () {
            for (var i = 0; i < array_entries.length; i++) {
                if (array_entries[i][2] == connection.peer) {
                    array_entries.splice(i, 1);
                    $('#token_registed').text(array_entries.length);
                    changeStartBtn()
                }
            }
            connection.close();
        });
    });

    //////////  //////////
    // 学習チームの人数が変更された時の関数
    $('#select_team').change(function () {
        var_selectbox = $(this).val();
        changeStartBtn();
    });
    // 開始ボタンの活性非活性を切り替え
    function changeStartBtn() {
        if (array_entries.length < var_selectbox) {
            $('#send-start').prop('disabled', true);
        } else {
            $('#send-start').prop('disabled', false);
        }
    }

    function operateScore(data) {
        // 学習者情報を更新する
        empty4promise()
            .then(function () {
                array_changeUser.push([data.name, data.score]);
            })
            .then(function () {
                for (var i = 0; i < array_teamAprogress.length; i++) {
                    if (array_teamAprogress[i][0] === data.name || array_teamAprogress[i][1] === data.name) {
                        array_teamAprogress[i][array_teamAprogress[i].length - 1] = data.progress;
                        displayProgress();
                    } else if (array_teamAprogress[i].length === 4) {
                        if (array_teamAprogress[i][2] === data.name) {
                            array_teamAprogress[i][array_teamAprogress[i].length - 1] = data.progress;
                            displayProgress();
                        }
                    } else if (array_teamAprogress[i].length === 5) {
                        if (array_teamAprogress[i][3] === data.name) {
                            array_teamAprogress[i][array_teamAprogress[i].length - 1] = data.progress;
                            displayProgress();
                        }
                    }
                }
            })
            .then(function () {
                if (token_changeuser == 0) {
                    changeUserPool();
                }
            });
    }

    function empty4promise() {
        return new Promise(function (resolve, reject) {
            resolve(1);
        });
    }

    ////////  ////////
    // 学習を開始するための関数
    $('#send-start').click(Start);

    function Start() {
        func_start()
            .then(function () {
                // スコアの降順にソート
                array_entries.sort(function (a, b) {
                    console.log(a[1]);
                    return a[1] - b[1];
                });
            })
            .then(function () {
                // ピアIDをペアリングし、配列に格納
                tmp_student = parseInt($("#select_team").val());
                // 余り処理のために、その対象となる人数を定義
                var tmp_pairing_adjust = 0;
                array_teamAprogress.length = 0;
                switch (array_entries.length % tmp_student) {
                    case 0:
                        // 全パターン：あまりなし
                        tmp_pairing_adjust = 0;
                        break;
                    case 1:
                        // 全パターン：あまり1
                        tmp_pairing_adjust = tmp_student + 1;
                        break;
                    case 2:
                        if (tmp_student <= 3) {
                            // 3人：あまり2
                            tmp_pairing_adjust = 2;
                        } else {
                            // 4人：あまり2
                            tmp_pairing_adjust = 6;
                        }
                        break;
                    case 3:
                        // 4人：あまり3
                        tmp_pairing_adjust = 3;
                        break;
                }
                return tmp_pairing_adjust;
            })
            .then(function (tmp_pairing_adjust) {
                // 基本ペアリング
                for (var i = 0; i < array_entries.length - tmp_pairing_adjust; i += tmp_student) {
                    tmp_array_team[tmp_array_team.length] = [];
                    array_teamAprogress[array_teamAprogress.length] = [];
                    for (var j = 0; j < tmp_student; j++) {
                        tmp_array_team[tmp_array_team.length - 1].push(array_entries[i + j][2]);
                        array_teamAprogress[array_teamAprogress.length - 1].push(array_entries[i + j][0]);
                    }
                    array_teamAprogress[array_teamAprogress.length - 1].push(0);
                }
                if (0 < tmp_pairing_adjust && tmp_pairing_adjust <= 4) {
                    // 余り処理１：調節されるチームは一つ
                    tmp_array_team[tmp_array_team.length] = [];
                    array_teamAprogress[array_teamAprogress.length] = [];
                    for (var x = tmp_pairing_adjust; x > 0; x--) {
                        tmp_array_team[tmp_array_team.length - 1].push(array_entries[array_entries.length - x][2]);
                        array_teamAprogress[array_teamAprogress.length - 1].push(array_entries[i + j][0]);
                    }
                    array_teamAprogress[array_teamAprogress.length - 1].push(0);
                } else if (tmp_pairing_adjust >= 5) {
                    // 余り処理２：調節されるチームは二つ
                    for (var y = tmp_pairing_adjust; y > 0; y -= 3) {
                        tmp_array_team[tmp_array_team.length] = [];
                        array_teamAprogress[array_teamAprogress.length] = [];
                        for (var z = 0; z < y && z < 3; z++) {
                            tmp_array_team[tmp_array_team.length - 1].push(array_entries[array_entries.length - y + z][2]);
                            array_teamAprogress[array_teamAprogress.length - 1].push(array_entries[i + j][0]);
                        }
                        array_teamAprogress[array_teamAprogress.length - 1].push(0);
                    }
                }
            })
            .then(function () {
                $('#displayStudent').text('');
                // 学習者へ送信
                for (var k = 0; k < tmp_array_team.length; k++) {
                    for (var l = 0; l < tmp_array_team[k].length; l++) {
                        console.log('send');
                        conn = peer.connect(tmp_array_team[k][l], {
                            metadata: {
                                // 変数（名前）をメタデータとして送信
                                'flag': 0,
                                'order': l,
                                'question': array_question[var_question],
                                'partnerKEYs': tmp_array_team[k]
                            }
                        });
                        console.log(conn);
                    }
                }
            })
            .then(function () {
                displayProgress();
                // リセット
                array_entries.length = 0;
                tmp_array_team.length = 0;
                $('#token_registed').text(array_entries.length);
                $('#send-start').prop('disabled', true);
            });
    }

    function func_start() {
        return new Promise(function (resolve, reject) {
            // セレクトボックスのデータを取得
            if ($("#select_question").val() != '0') {
                var_question = parseInt($("#select_question").val()) - 1;
            } else {
                var_question = Math.floor(Math.random() * (array_question.length));
            }
            tmp_last_question.length = 0;
            tmp_last_question = array_question[var_question][1].split(" ");
            resolve(1);
        });
    }

    function displayProgress() {
        $('#displayStudent').text('');
        for (var i = 0; i < array_teamAprogress.length; i++) {
            console.log(array_teamAprogress[i]);
            $('#displayStudent').append('<ul>');
            for (var j = 0; j < array_teamAprogress[i].length - 1; j++) {
                $('#displayStudent').append(array_teamAprogress[i][j].substring(array_teamAprogress[i][j].indexOf(" ") + 1, array_teamAprogress[i][j].length));
                if (j < array_teamAprogress[i].length - 2) {
                    $('#displayStudent').append(', ');
                }
            }
            var tmp_progress = 0;
            $('#displayStudent').append(':');
            while (array_teamAprogress[i][array_teamAprogress[i].length - 1] - tmp_progress > 0) {
                $('#displayStudent').append('■');
                tmp_progress++;
            }
            if (array_teamAprogress[i][array_teamAprogress[i].length - 1] >= tmp_last_question.length) {
                $('#displayStudent').append(' Finish!');
            }
            $('#displayStudent').append('</ul>');
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

    // URLを取得
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

    // 管理者情報の変更
    function ChangeInfo(iframe, APIKey) {
        return new Promise(function (resolve) {
            var doc = iframe.contentDocument;
            var list_a = doc.getElementsByTagName('a');
            for (item_a of list_a) {
                if (item_a.href.match(/rid\=/)) {
                    var editPage = item_a.href;
                    injectIframe(editPage)
                        .then(function (iframe2) {
                            EditAct(iframe2, APIKey);
                        });
                }
            }
            removeElement(iframe);
            resolve(1);
        });
    }

    // 実際に変更処理を行う関数
    function EditAct(iframe, APIKey) {
        var ary_data = [APIKey, 1, 1, 1];
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
                removeElement(iframe);
                //resolve(iframe);
                resolve(1);
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
                removeElement(iframe);
                //resolve(iframe);
                resolve(1);
            }
            setTimeout(function () {
                //reject("submitNewdiscussion: timeout: over " + injectIframe.timeout + "ms: " + + iframe.src + ": " + form.action);
            }, injectIframe.timeout);
            form.submit();
        });
    }

    function changeUserPool() {
        token_changeuser = 1;
        GetURL(iframe_url, 'DB_USER', 'view')
            .then(injectIframe)
            .then(function (iframe) {
                for (var i = 0; i < array_changeUser.length; i ++) {
                    ChangeUserData(iframe, array_changeUser[i][0], array_changeUser[i][1]);
                }
            })
            .then(function () {
                console.log('7');
                array_changeUser.length = 0;
                token_changeuser = 0;
             });
    }

    function ChangeUserData(iframe, name, score) {
        console.log('3');
        reg = new RegExp('^name:' + name);
        return new Promise(function (resolve) {
            var doc = iframe.contentDocument;
            var list_div = doc.getElementsByTagName('div');
            for (item_div of list_div) {
                if (item_div.textContent.match(reg)) {
                    console.log(item_div);
                    var list_a = item_div.getElementsByTagName('a');
                    for (item_a of list_a) {
                        if (item_a.href.match(/rid\=/)) {
                            var editPage = item_a.href;
                            injectIframe(editPage)
                                .then(function (iframe2) {
                                    EditActUser(iframe2, name, score);
                                });
                        }
                    }
                }
            }
            //removeElement(iframe);
            resolve(1);
        });
    }

    function EditActUser(iframe, name, score) {
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
                removeElement(iframe);
                //resolve(iframe);
                resolve(1);
            }
            setTimeout(function () {
                //reject("submitNewdiscussion: timeout: over " + injectIframe.timeout + "ms: " + + iframe.src + ": " + form.action);
            }, injectIframe.timeout);
            form.submit();
        });
    }

});