$(function () {
    //////// �ϐ���` ////////
    // PeerJS�p�ϐ�
    var conn;
    // �Z���N�g�{�b�N�X�̏����l
    var var_question = 0, var_selectbox = 2;
    // �z���`
    var array_question = new Array();
    var array_entries = new Array();
    // ���t�@�C����
    var TSVFILE = 'https://rawgit.com/tomkaw/English_Learning/master/resource/question.tsv';

    ////// PeerJS�����ݒ� //////
    // �V�KPeerJS�C���X�^���X
    var peer = new Peer({
        // API�L�[
        //key: '3cbz326wgxlgnwmi',
	key: '900d7a23-6264-4afe-8896-15f0d020ca61',
        turn: false,
        //host: '10.159.13.70',
        //port: 443,
        //path: '/peerjs',
        //secure: true,
        //�f�o�b�O���[�h�̏璷��
        debug: 3,
        // ICE�T�[�o
        config: {
            'iceServers': [
                { url: 'stun:stun1.l.google.com:19302' },
                {
                    url: 'turn:numb.viagenie.ca',
                    credential: 'muazkh', username: 'webrtc@live.com'
                }]
        }
    });

    // �g�p�u���E�U��Ԃ�
    navigator.getUserMedia = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia;

    // �C���X�^���X�쐬�ɐ�������Ǝ��s�����
    peer.on('open', function () {
        if (peer.id == null) {
            console.log("Connection is closed.")
        } else {
            GetTSV();
            IframeSetting();
        }
    });

    //////// ���DB�̓ǂݍ��� ////////
    function GetTSV() {
        d3.tsv(TSVFILE, function (error, data) {
            $('#wrapper_learning').removeClass('hidden');
            for (var i in data) {
                array_question[i] = [('000' + i).slice(-3), data[i].String, data[i].Translation];
                $("#select_question").append($("<option>").val(parseInt(i) + 1).text(parseInt(i) + 1));
            }
        });
    }

    //////// �Ǘ��҃f�[�^�̍X�V ////////
    function IframeSetting() {
        getCourseURL()
            .then(function (url) {
                GetURL(url, 'DB_REGIST', 'view')
                    .then(injectIframe)
                    .then(function (iframe) {
                        ChangeInfo(iframe, peer.id);
                        $('#registeduser').removeClass('hidden');
                        $('#button_container').removeClass('hidden');
                        $('#token_registed').text('0');
                    })
            })
    }

    //////// PeerJS ////////
    peer.on('connection', function (connection) {
        // �w�K�҂̃f�[�^��z��Ɋi�[
        array_entries[array_entries.length] = [connection.metadata.score, connection.peer];
        $('#token_registed').text(array_entries.length);
        changeStartBtn();
        // �ؒf���ꂽ���̏���
        connection.on('close', function () {
            for (var i = 0; i < array_entries.length; i++) {
                if (array_entries[i][1] == connection.peer) {
                    array_entries.splice(i, 1);
                    $('#token_registed').text(array_entries.length);
                    changeStartBtn()
                }
            }
        });
    });

    // �w�K�`�[���̐l�����ύX���ꂽ���̊֐�
    $('#select_team').change(function () {
        var_selectbox = $(this).val();
        changeStartBtn()
    });

    function changeStartBtn() {
        if (array_entries.length < var_selectbox) {
            $('#send-start').prop('disabled', true);
        } else {
            $('#send-start').prop('disabled', false);
        }
    }

    // �w�K���J�n���邽�߂̊֐�
    $('#send-start').click(Start);

    function Start() {
        // �Z���N�g�{�b�N�X�̃f�[�^���擾
        if ($("#select_question").val() != '0') {
            var_question = parseInt($("#select_question").val()) - 1;
        } else {
            var_question = Math.floor(Math.random() * (array_question.length));
        }
        console.log(var_question);

        // �X�R�A�̍~���Ƀ\�[�g
        array_entries.sort(function (a, b) {
            return a - b;
            // if (a[0] < b[0]) {
            //     return -1;
            // } else {
            //     return 1;
            // }
        });

        // �s�AID���y�A�����O���A�z��Ɋi�[
        var tmp_student = parseInt($("#select_team").val());
        var tmp_array_team = new Array();
        // �]�菈���̂��߂ɁA���̑ΏۂƂȂ�l�����`
        var tmp_pairing_adjust = 0;
        switch (array_entries.length % tmp_student) {
            case 0:
            // �S�p�^�[���F���܂�Ȃ�
                tmp_pairing_adjust = 0;
                break;
            case 1:
            // �S�p�^�[���F���܂�1
                tmp_pairing_adjust = tmp_student + 1;
                break;
            case 2:
                if (tmp_student <= 3) {
                    // 3�l�F���܂�2
                    tmp_pairing_adjust = 2;
                } else {
                    // 4�l�F���܂�2
                    tmp_pairing_adjust = 6;
                }
                break;
            case 3:
            // 4�l�F���܂�3
                tmp_pairing_adjust = 3;
                break;
        }
        // ��{�y�A�����O
        for (var i = 0; i < array_entries.length - tmp_pairing_adjust; i += tmp_student) {
            tmp_array_team[tmp_array_team.length] = [];
            for (var j = 0; j < tmp_student; j++) {
                tmp_array_team[tmp_array_team.length - 1].push(array_entries[i + j][1]);
            }
        }
        // �]�菈���P�F���߂����`�[���͈��
        if (0 < tmp_pairing_adjust && tmp_pairing_adjust <= 4) {
            tmp_array_team[tmp_array_team.length] = [];
            for (var x = tmp_pairing_adjust; x > 0; x--) {
                tmp_array_team[tmp_array_team.length - 1].push(array_entries[array_entries.length - x][1]);
            }
        // �]�菈���Q�F���߂����`�[���͓��
        } else if (tmp_pairing_adjust >= 5) {
            for (var y = tmp_pairing_adjust; y > 0; y -= 3) {
                tmp_array_team[tmp_array_team.length] = [];
                for (var z = 0; z < y && z < 3; z++) {
                    console.log(array_entries.length + '-' + y + '+' + z + '=' + (array_entries.length - y + z));
                    tmp_array_team[tmp_array_team.length - 1].push(array_entries[array_entries.length - y + z][1]);
                }
            }
        }

        // �w�K�҂֑��M
        for (var k = 0; k < tmp_array_team.length; k++) {
            console.log(tmp_array_team);
            for (var l = 0; l < tmp_array_team[k].length; l++) {
                conn = peer.connect(tmp_array_team[k][l], {
                    metadata: {
                        // �ϐ��i���O�j�����^�f�[�^�Ƃ��đ��M
                        'flag': 0,
                        'order': l,
                        'question': array_question[var_question],
                        'partnerKEYs': tmp_array_team[k]
                    }
                });
                conn.close();
                console.log('sended to ' + tmp_array_team[k][l]);
            }
        }

        // ���Z�b�g
        array_entries.length = 0;
        $('#token_registed').text(array_entries.length);
        $('#send-start').prop('disabled', true);
    }

    //////// iframe�֐� ////////
    // Moodle�̃R�[�X�����擾
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

    // iframe�^�I�u�W�F�N�g���폜
    function removeElement(e) {
        e.parentNode.removeChild(e);
        return e;
    }

    // iframe�^�I�u�W�F�N�g���쐬
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

    // URL���擾
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

    // �Ǘ��ҏ��̕ύX
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
        });
    }

    // ���ۂɕύX�������s���֐�
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
                resolve(iframe);
            }
            setTimeout(function () {
                //reject("submitNewdiscussion: timeout: over " + injectIframe.timeout + "ms: " + + iframe.src + ": " + form.action);
            }, injectIframe.timeout);
            form.submit();
        });
    }
});