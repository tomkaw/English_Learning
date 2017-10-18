$(function () {
    // �ϐ���`
    var peer_id, conn;	// �s�AID�A�ڑ�
    var user_name, user_score;  // �����̖��O�A�X�R�A
    // �z���`
    var messages = [];	// ���b�Z�[�W���i�[
    // iframe�p�ϐ�
    var iframe_url;
    injectIframe.timeout = 10000;
    // �`���b�g�\���̃e���v���[�g�ihandlerbars�j
    var messages_template = Handlebars.compile($('#messages-template').html());

////// PeerJS�����ݒ� //////
    // �V�KPeerJS�C���X�^���X
    var peer = new Peer({
        // API�L�[
        key: '3cbz326wgxlgnwmi',
        //�f�o�b�O���[�h�̏璷��
        debug: 3,
        // ICE�T�[�o
        config: {
            'iceServers': [
            { url: 'stun:stun1.l.google.com:19302' },
            { url: 'turn:numb.viagenie.ca',
              credential: 'muazkh', username: 'webrtc@live.com' }]
        }
    });

    // �g�p�u���E�U��Ԃ�
    navigator.getUserMedia = navigator.getUserMedia ||
                             navigator.webkitGetUserMedia ||
                             navigator.mozGetUserMedia;

    // �C���X�^���X�쐬�ɐ�������Ǝ��s�����
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
                    // ���g�̊w�K�ҏ�񂪓o�^����Ă��Ȃ������ꍇ
                    user_score = 1500;
                    // �f�[�^�̓o�^
                //    GetURL(iframe_url, 'DB_USER', 'edit')
                //    .then(injectIframe)
                //    .then(function (iframe2) {
                //        RegistUserData(iframe2, token_user_name, token_user_score);
                //    });
                } else {
                    // �o�^����Ă����ꍇ
                    user_score = mydata['score'];
                }
                // ��ʕ\��
                $('#token_user_name').text(user_name);
                $('#token_user_score').text(user_score);
                $('#myData').removeClass('hidden');
            })
    });

////// iframe�֐� //////
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

    // �\�[�g�����̕ύX
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