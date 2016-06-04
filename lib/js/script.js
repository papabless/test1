var socket;
var users = 0;
var canvas;
var coins = [];
var birds = [];
var betsAmount = 0;
var mark = false;
var Hash = "";
var showingrecaptcha = false;
var boardHtml = "";
var user_balance = 0;
var claimedTime = false;
var faucetTimer;
var access_token = null;

if(typeof $.cookie('faucetClaim') === "undefined"){
    claimedTime = false;
    $.cookie('faucetClaim', claimedTime);
}else{
    claimedTime = parseInt($.cookie('faucetClaim'));
    if(claimedTime && claimedTime > 0){
        faucetTimer = setInterval(function(){
            if(parseInt(claimedTime)+300000<=(new Date()).getTime()){
                $('#faucetButton').removeClass("claimed");
                clearInterval(faucetTimer);
                claimedTime = false;
                $('#faucetButton').attr("disabled", false);
                $('#faucetButton').text("FAUCET");
                
                if($.cookie('faucetClaim') != "undefined") $.removeCookie('faucetClaim');
                $.cookie('faucetClaim', claimedTime);
                
                return;
            }else{
                $('#faucetButton').attr("disabled", true);
                $('#faucetButton').addClass("claimed");
                $('#faucetButton').text(parseFloat( 300-(((new Date()).getTime()-claimedTime)/1000) ).formatMoney(2,'.',','));
            }
        }, 100);
    }
}
// new Audio("/sounds/gong.mp3").play()

if(typeof $.cookie('gameBet') === "undefined"){
    var betSave = 2;
    $.cookie('gameBet', betSave);
}else{
    var betSave = $.cookie('gameBet');
}

if(typeof $.cookie('gameBombs') === "undefined"){
    var gameBombs = 3;
    $.cookie('gameBombs', gameBombs);
}else{
    var gameBombs = $.cookie('gameBombs');
}

var audioMuted = false;

var connected = false;

if(typeof $.cookie('clientSeed') === "undefined"){
    var clientSeed = "123456";
    $.cookie('clientSeed', clientSeed);
}else{
    var clientSeed = $.cookie('clientSeed');
}

var game = {
    status: "?",
    profit: 0,
    bet: parseInt(betSave),
    bombs: parseInt(gameBombs),
    clientSeed: clientSeed,
    tilesClicked: 0,
    odds: 0,
    next: 0,
    stake: 0
};

$("#bet").val(game.bet);

$("#bombsButtons .button").each(function(index){
    if(game.bombs == 1){
        if(index === 0) $(this).addClass("active");
        else $(this).removeClass("active");
    }else if(game.bombs == 3){
        if(index === 1) $(this).addClass("active");
        else $(this).removeClass("active");
    }else if(game.bombs == 5){
        if(index === 2) $(this).addClass("active");
        else $(this).removeClass("active");
    }else if(game.bombs == 24){
        if(index === 3) $(this).addClass("active");
        else $(this).removeClass("active");
    }else{
        if(index === 4){
            $(this).addClass("active");
            $('#customBombs').val(game.bombs);
            $('#customBombsInputArea').css("display", "inline-flex");
        }else $(this).removeClass("active");
    }
});

function setBet(x){
    game.bet =  Math.floor(parseFloat(x));
    betSave = game.bet;
    if($.cookie('gameBet') != "undefined") $.removeCookie('gameBet');
    $.cookie('gameBet', betSave);
}

function setBombs(x){
    game.bombs = Math.floor(parseFloat(x));
    if($.cookie('gameBombs') != "undefined") $.removeCookie('gameBombs');
    $.cookie('gameBombs', game.bombs);
}

function setClientSeed(x){
    game.clientSeed = parseFloat(x);
    if($.cookie('clientSeed') != "undefined") $.removeCookie('clientSeed');
    $.cookie('clientSeed', game.clientSeed);
}

$(function(){
    var loaderContainer = jQuery('<div/>', {
        id:     'loaderContainer',
        style:  "position: absolute;"+
                "top: 0; right: 0; bottom: 0; left: 0;"+
                "z-index: 2000;"
    }).appendTo('body');
    
    var loaderSegment = jQuery('<div/>', {
        class:  'ui segment',
        style:  'height: 100%; opacity: 0.7;'
    }).appendTo(loaderContainer);
    
    var loaderDimmer = jQuery('<div/>', {
        class:  'ui active dimmer'
    }).appendTo(loaderSegment);
    
    var loaderText = jQuery('<div/>', {
        id:     'loaderText',
        class:  'ui text loader',
        text:   'Connecting'
    }).appendTo(loaderDimmer);
    
    if(getURLParameter('access_token')!="" && getURLParameter('access_token')!=null){
        access_token = getURLParameter('access_token');
        window.history.pushState('', 'BitMine', '/');
    }

    // https://blog.moneypot.com/introducing-socketpot/
    socket = io('https://socket.moneypot.com');
    var config = {
        app_id: 1115,
        access_token: ((access_token!="" && access_token!=null)?access_token:undefined),
        subscriptions: ['CHAT', 'DEPOSITS', 'BETS']
    };

    socket.on('connect', function() {
        console.info('[socketpot] connected');
        var authRequest = {
            app_id: config.app_id,
            access_token: config.access_token,
            subscriptions: config.subscriptions
        };
        socket.emit('auth', authRequest, function(err, authResponse) {
            if (err) {
                $('#loaderContainer').css('display', 'block');
                $('#loaderText').text('Error while connecting: '+ err);
                console.error('[auth] Error:', err);
                return;
            }
            var authData = authResponse;
            $('#loaderContainer').css('display', 'none');
            if(access_token!="" && access_token!=null){
                $("#connectButton").css('display', 'none');
                jQuery('<input/>', {
                    id:     'chatText',
                    type:   'text',
                    maxlength: '200',
                    placeholder: 'Chat here'
                }).appendTo('#chat');
                
                jQuery('<button/>', {
                    id:     'chatButton',
                    text:   'Send'
                }).appendTo('#chat');
                
                $( "#chatText" ).keyup(function(event){
                    onkeyup_check(event)
                });
                
                $( "#chatButton" ).click(function(){
                    sendMessage(String(document.getElementById('chatText').value));
                });
                
                $.getJSON("https://api.moneypot.com/v1/token?access_token="+access_token, function(json){
                    $('#connectionText').css('display', 'block');
                    $('#betPanel').css('display', 'block');
                    $('#depositButton').css('display', "inline-block");
                    $('#withdrawButton').css('display', "inline-block");
                    $('#username').text(json.auth.user.uname);
                    $('#balance').text((json.auth.user.balance/100).formatMoney(2,'.',','));
                    user_balance = (json.auth.user.balance/100);
                    connected = true;
                    $('#highRoller_log').css('display', "block");
                    $('#highRoller_logs').html("<div class=\"ui active loader\"></div>");

                    $('.chatMessage').each(function(index){
                        var message = $(this).html().split(":")[1];
                        $(this).html($(this).html().replace('@'+$('#username').text(), "<span class='notify'>@"+$('#username').text()+"</span>"));
                    });
                });

                $.getJSON("https://api.moneypot.com/v1/list-bets?access_token="+access_token+"&app_id=1115&wager=500000&limit=11&order_by=desc", function(json){
                    $('#highRoller_logs').html("");
                    if(json.length > 0){
                        $.each(json.reverse(), function(index){
                            if(json[index].profit <= 0){
                                $('#highRoller_logs').html("<div class=\"hr_log_item\" style=\"border-left: 4px solid #E74C3C;\"><b><a href=\"https://www.moneypot.com/users/"+json[index].uname+"\">"+json[index].uname+"</a></b>: <span style=\"color: #E74C3C\">"+(parseFloat(json[index].wager/100).formatMoney(2,'.',','))+"</span> Bits! <div class=\"info\"><a href=\"https://www.moneypot.com/bets/"+json[index].id+"\" target=\"_blank\"><i class=\"info circle icon\"></i></a></div></div>"+$('#highRoller_logs').html());
                            }else{
                                $('#highRoller_logs').html("<div class=\"hr_log_item\" style=\"border-left: 4px solid #8D4;\"><b><a href=\"https://www.moneypot.com/users/"+json[index].uname+"\">"+json[index].uname+"</a></b>: <span style=\"color: #8D4\">"+(parseFloat(json[index].wager/100).formatMoney(2,'.',','))+"</span> Bits! <div class=\"info\"><a href=\"https://www.moneypot.com/bets/"+json[index].id+"\" target=\"_blank\"><i class=\"info circle icon\"></i></a></div></div>"+$('#highRoller_logs').html());
                            }

                            $('.hr_log_item').each(function(index){
                                if(index>10) $(this).remove();
                            });
                        });
                    }
                });
                
                console.log(authData);
            }
            
            users = ObjectLength(authData.chat.userlist);
            $("#connectedUsersAmount").text(users);
            
            for(var i=0; i<authData.chat.messages.length; i++){
                addNewChatMessage(authData.chat.messages[i]);
            }
            var chatMonitor = document.getElementById("chatMonitor");
            chatMonitor.innerHTML += "<span class=\"chatMessage\"><div style=\"border-top:1px solid rgba(241,196,15,0.3);border-bottom:1px solid rgba(241,196,15,0.3);background-color:rgba(241,196,15,0.2);\"><span style=\"color: #F1C40F;font-weight:bold;\">Warning:</span> Never give your access_token to anyone or run unknown scripts. This may compromise your wallet security.</div><br></span>";
            chatMonitor.scrollTop = chatMonitor.scrollHeight;
        });
    });

    socket.on('disconnect', function() {
        console.warn('[socketpot] disconnected');
        document.getElementById("chatMonitor").innerHTML = "";
        connected = false;
    });
    socket.on('client_error', function(err) {
        console.error('[socketpot] client_error:', err);
    });
    socket.on('error', function(err) {
        console.error('[socketpot] error:', err);
    });
    socket.on('reconnect_error', function(err) {
        console.error('[socketpot] error while reconnecting:', err);
        $('#loaderContainer').css('display', 'block');
        $('#loaderText').text('Error while reconnecting: '+ err);
        connected = false;
    });
    socket.on('reconnecting', function() {
        console.warn('[socketpot] attempting to reconnect...');
        $('#loaderContainer').css('display', 'block');
        $('#loaderText').text('Reconnecting');
        connected = false;
    });
    socket.on('reconnect', function() {
        console.info('[socketpot] successfully reconnected');
        $('#loaderContainer').css('display', 'none');
        connected = true;
    });

    // chat related
    socket.on('user_joined', function(data) {
        users++;
        $("#connectedUsersAmount").text(users);
        console.log(data.uname+" joined the chat. ("+users+" users online)");
    });
    socket.on('user_left', function(data) {
        users--;
        $("#connectedUsersAmount").text(users);
        console.log(data.uname+" left the chat. ("+users+" users online)");
    });
    socket.on('new_message', function(payload) {
        addNewChatMessage(payload);
    });
    socket.on('new_bet', function(payload) {
        var table = document.getElementById("game_allbets_logs");
            
        var row = table.insertRow(0);
        row.id = "bet_"+payload.id;
        row.className = "allbets_log_item";
        
        var cell1 = row.insertCell(0);
        var cell2 = row.insertCell(1);
        var cell3 = row.insertCell(2);
        var cell4 = row.insertCell(3);
        
        var win = parseFloat(payload.profit) >= 0;
        
        cell1.innerHTML = "<a href=\"https://www.moneypot.com/bets/"+payload.id+"\" target=\"blank\">"+payload.id+"</a>";
        cell1.className = (win?"win":"lose");

        cell2.innerHTML = "<a href=\"https://www.moneypot.com/users/"+payload.uname+"\">"+payload.uname+"</a>";
        cell3.innerHTML = (payload.wager/100).formatMoney(2, '.', ',')+" Bits";
        
        cell4.innerHTML = (win?"+":"")+(payload.profit/100).formatMoney(2, '.', ',');
        cell4.className = "right aligned";

        if((payload.wager/100)>=5000){
            if(payload.profit <= 0){
                $('#highRoller_logs').html("<div class=\"hr_log_item\" style=\"border-left: 4px solid #E74C3C;\"><b><a href=\"https://www.moneypot.com/users/"+payload.uname+"\">"+payload.uname+"</a></b>: <span style=\"color: #E74C3C\">"+(parseFloat(payload.wager/100).formatMoney(2,'.',','))+"</span> Bits! <div class=\"info\"><a href=\"https://www.moneypot.com/bets/"+payload.id+"\" target=\"_blank\"><i class=\"info circle icon\"></i></a></div></div>"+$('#highRoller_logs').html());
            }else{
                $('#highRoller_logs').html("<div class=\"hr_log_item\" style=\"border-left: 4px solid #8D4;\"><b><a href=\"https://www.moneypot.com/users/"+payload.uname+"\">"+payload.uname+"</a></b>: <span style=\"color: #8D4\">"+(parseFloat(payload.wager/100).formatMoney(2,'.',','))+"</span> Bits! <div class=\"info\"><a href=\"https://www.moneypot.com/bets/"+payload.id+"\" target=\"_blank\"><i class=\"info circle icon\"></i></a></div></div>"+$('#highRoller_logs').html());
            }

            $('.hr_log_item').each(function(index){
                if(index>10) $(this).remove();
            });
        }

        $('.allbets_log_item').each(function(index){
            if(index>10) $(this).remove();
        });
    });

    // balance updated
    socket.on('balance_change', function(payload) {
        $('#balance').text((payload.balance/100).formatMoney(2,'.',','));
        user_balance = (payload.balance/100);
    });
});

function getURLParameter(name) {
  return decodeURIComponent((new RegExp('[#|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.hash)||[,""])[1].replace(/\+/g, '%20'))||null
}

function onkeyup_check(e){
    if (e.keyCode == 13){
        sendMessage(document.getElementById("chatText").value);
    }
}

function sendMessage(data){
    document.getElementById("chatText").value = "";
    var text = data;
    
    if(text.split(" ")[0] == "!tip" && text.split(" ").length == 3){
        tipUser(text.split(" ")[1], text.split(" ")[2]);
        return;
    }


    socket.emit('new_message', {
        text: data
    }, function(err, msg){
        if (err) {
            console.log('Error when submitting new_message to server:', err);
            return;
        }
        console.log('Successfully submitted message:', msg);
    });
}

function ObjectLength( object ) {
    var length = 0;
    for( var key in object ) {
        if( object.hasOwnProperty(key) ) {
            ++length;
        }
    }
    return length;
};

function addNewChatMessage(data){
    if(typeof data.user !== "undefined" && typeof data.channel !== "undefined"){
        var username = escapeHTML(data.user.uname);
        var rank = data.user.role;
    }else{
        var username = "Server";
        var rank = "server";
    }
    var date = {
        hours: addZero((new Date(data.created_at)).getHours()),
        mins: addZero((new Date(data.created_at)).getMinutes())
    }
    var message = escapeHTML(data.text);
    
    if(message.split(" ")[0] == "!tip" && message.split(" ").length == 3){
        message = "@"+username+" sent @"+message.split(" ")[1]+" "+message.split(" ")[2]+" Bits.";
        username = "Server";
        rank = "server";
    }
    var notify = false;
    if($('#username').text() != "" && message.indexOf('@'+$('#username').text())>-1){
        if(username!=$('#username').text()) notify = true;
        message = message.replace('@'+$('#username').text(), "<span class='notify'>@"+$('#username').text()+"</span>");
    }
    
    var chatMonitor = document.getElementById("chatMonitor");
    var servStyle = (username=="Server"?"style='color:lime;font-weight:bold;'":"");
    var modStyle = ((rank=="MOD")?"style='color:green;'":"");
    var ownerStyle = ((rank=="OWNER")?"style='color:red;'":"");
    chatMonitor.innerHTML += "<span class=\"chatMessage "+(notify?"notify":"")+"\" "+servStyle+"><small>"+date.hours+":"+date.mins+"</small> <b "+modStyle+" || "+ownerStyle+">"+username+"</b>: "+message+"<br></span>";
    chatMonitor.scrollTop = chatMonitor.scrollHeight;
    
    var allChatMessages = document.getElementsByClassName("chatMessage");
    if(allChatMessages.length > 120){
        chatMonitor.removeChild(allChatMessages[0]);
    }
}

function addZero(i) {
    if (i < 10) {
        i = "0" + i;
    }
    return i;
}

Number.prototype.formatMoney = function(c, d, t){
    var n = this, 
        c = isNaN(c = Math.abs(c)) ? 2 : c, 
        d = d == undefined ? "." : d, 
        t = t == undefined ? "," : t, 
        s = n < 0 ? "-" : "", 
        i = parseInt(n = Math.abs(+n || 0).toFixed(c)) + "", 
        j = (j = i.length) > 3 ? j % 3 : 0;
    return s + (j ? i.substr(0, j) + t : "") + i.substr(j).replace(/(\d{3})(?=\d)/g, "$1" + t) + (c ? d + Math.abs(n - i).toFixed(c).slice(2) : "");
};

$('#depositButton').click(function() {
    $.get( "https://api.moneypot.com/v1/deposit-address?access_token="+access_token, function( data ) {
        $('#depositForm').modal('setting', 'closable', false).modal('show');
        if(typeof data.deposit_address !== "undefined"){
            $('#depositBtcAddy').text(data.deposit_address);
        }else{
            $('#depositBtcAddy').text("Couldn't request a deposit addy. Please, use moneypot.");
        }
    });
});

$('#moneypotDepositButton').click(function() {
    var windowUrl = 'https://www.moneypot.com/dialog/deposit?app_id=1115';
    var windowName = 'manage-auth';
    var windowOpts = 'width=420,height=350,left=100,top=100';
    var windowRef = window.open(windowUrl, windowName, windowOpts);
    windowRef.focus();
});

$('#withdrawButton').click(function() {
    var windowUrl = 'https://www.moneypot.com/dialog/withdraw?app_id=1115';
    var windowName = 'manage-auth';
    var windowOpts = 'width=420,height=350,left=100,top=100';
    var windowRef = window.open(windowUrl, windowName, windowOpts);
    windowRef.focus();
});

function onloadCallback() {
    grecaptcha.render('faucetClaimCaptcha', {
        'sitekey' : '6LcFXR8TAAAAAL0DIqGJBNhrtul2kwY-Z6lUhEjm',
        'callback' : correctCaptcha
    });
};

function correctCaptcha(response) {
    $.ajax({
        type: "POST",
        contentType: "application/json",
        url: "https://api.moneypot.com/v1/claim-faucet?access_token="+access_token,
        data: JSON.stringify({
            "response": response
        }),
        dataType: "json"
    }).done(function(data) {
        console.log((data.amount/100)+" has been added to your balance!");
        $.get( "https://api.moneypot.com/v1/auth?access_token="+access_token, function( data ) {
            if(typeof data.user.uname !== "undefined"){
                user_balance = (data.user.balance/100);
                $('#balance').text((user_balance).formatMoney(2,'.',','));
            }
        });
        $("#faucetClaimCaptcha").css("top", "-90px");
        grecaptcha.reset();
        showingrecaptcha = false;
        claimedTime = (new Date()).getTime();
        faucetTimer = setInterval(function(){
            if(parseInt(claimedTime)+300000<=(new Date()).getTime()){
                $('#faucetButton').removeClass("claimed");
                clearInterval(faucetTimer);
                claimedTime = false;
                $('#faucetButton').attr("disabled", false);
                $('#faucetButton').text("FAUCET");
                return;
            }else{
                $('#faucetButton').attr("disabled", true);
                $('#faucetButton').addClass("claimed");
                $('#faucetButton').text(parseFloat( 300-(((new Date()).getTime()-claimedTime)/1000) ).formatMoney(2,'.',','));
            }
        }, 100);
        if($.cookie('faucetClaim') != "undefined") $.removeCookie('faucetClaim');		
        $.cookie('faucetClaim', claimedTime);
    }).fail(function(data) {
        var error = data.error;
        if(error == "FAUCET_ALREADY_CLAIMED"){
            console.error("Faucet already claimed");
            grecaptcha.reset();
        }else if(error == "INVALID_INPUT_RESPONSE"){
            console.error("Google has rejected the response. Try to refresh and do again.");
            grecaptcha.reset();
        }
        $("#faucetClaimCaptcha").css("top", "-90px");
        showingrecaptcha = false;
    });
};

$("#faucetButton").click(function(){
    if(showingrecaptcha == false){
        $("#faucetClaimCaptcha").css("top", "10px");
        showingrecaptcha = true;
        console.log("showing google recaptcha");
    }else if(showingrecaptcha == true){
        $("#faucetClaimCaptcha").css("top", "-90px");
        showingrecaptcha = false;
        console.log("hiding google recaptcha");
    }
});

$("#bombsButtons .button").each(function(index){
    $(this).click(function(){
        $("#bombsButtons .button").each(function(){
            $(this).removeClass("active");
        });
        $(this).addClass("active");
        if(index===0){game.bombs = 1;}
        else if(index===1){game.bombs = 3;}
        else if(index===2){game.bombs = 5;}
        else if(index===3){game.bombs = 24;}
        else if(index===4){game.bombs = parseInt($('#customBombs').val());}

        if($(this).hasClass('customBombsButton')){
            $('#customBombsInputArea').css("display", "inline-flex");
        }else{
            $('#customBombsInputArea').css("display", "none");
        }
    });
});

var houseEdge, odds, next;
function startNewGame(){
    if(!connected){
        $('#theDimmer').html("Error: Not connected!<br><a href=\"https://www.moneypot.com/oauth/authorize?app_id=1115&response_type=token&state=Meh&redirect_uri=http://bitmine.xyz\">Click here to login</a>");
        $('#game_left').dimmer('show');
        return;
    }

    $('#loaderContainer').css('display', 'block');
    $('#loaderText').text('Getting new Hash for provably fair');

    $(".settingsButon").css("display", "none");

    $.post("https://api.moneypot.com/v1/hashes?access_token="+access_token, '', function(json) {
        console.log("[Provably fair] We received our hash: "+json.hash);
        Hash = (typeof json.hash === "undefined"?false:json.hash);
        $('#loaderContainer').css('display', 'none');

        if(Hash == "" || Hash == false){
            $('#theDimmer').html("Error: Not connected!<br><a href=\"https://www.moneypot.com/oauth/authorize?app_id=1115&response_type=token&state=Meh&redirect_uri=http://bitmine.xyz\">Click here to login</a>");
            $('#game_left').dimmer('show');
            $(".settingsButon").css("display", "inline-block");
            return;
        }

        if(game.bombs < 1 || game.bombs > 24){
            $('#theDimmer').html("Error: Bombs amount!<br>(min 1 & max 24)");
            $('#game_left').dimmer('show');
            $(".settingsButon").css("display", "inline-block");
            return;
        }

        game.tilesClicked = 0;
        houseEdge = 0.0070; // 0.7%
        odds = ( (25.1-game.bombs-game.tilesClicked) / (25-game.tilesClicked) );
        next = ( game.bet * ((1.0-houseEdge)/odds) ) - game.bet;
        game = {
            status: "IN_PROGRESS",
            profit: 0,
            bet: game.bet,
            bombs: game.bombs,
            clientSeed: game.clientSeed,
            tilesClicked: 0,
            odds: odds,
            next: next,
            stake: game.bet
        };

        if(user_balance-game.bet<0){
            $('#theDimmer').html("Error: Not enough Balance!");
            $('#game_left').dimmer('show');

            game = {
                status: "ENDED",
                profit: game.stake,
                bet: parseInt($("#bet").val()),
                bombs: game.bombs,
                clientSeed: game.clientSeed,
                tilesClicked: 0,
                odds: 0,
                next: 0,
                stake: 0
            }

            $(".settingsButon").css("display", "inline-block");
            return;
        }

        if(game.bet<0){
            $('#theDimmer').html("Error: Invalid bet amount!");
            $('#game_left').dimmer('show');

            game = {
                status: "ENDED",
                profit: game.stake,
                bet: parseInt($("#bet").val()),
                bombs: game.bombs,
                clientSeed: game.clientSeed,
                tilesClicked: 0,
                odds: 0,
                next: 0,
                stake: 0
            }

            $(".settingsButon").css("display", "inline-block");
            return;
        }

        $('#cashoutButton').css("display", "inline-block");
        $('#next_value').text(parseFloat(game.next).formatMoney(2,'.',','));
        $('#stake_value').text(parseFloat(game.stake).formatMoney(2,'.',','));

        boardHtml = $("#board").html();
        $("#board").html("");
        for(var i=0; i<25; i++){
            $("#board").append("<li data-tile='"+i+"' class='tile'></li>");
        }

        $(".tile").each(function(ndx){
            $(this).click(function(){
                if(game.status != "IN_PROGRESS") return;

                var foundLoading = false;
                $('.tile').each(function(index){
                    if($(this).hasClass("tileLoading")) foundLoading = true;
                });
                if(foundLoading) return;

                user_balance -= game.stake;
                $('#balance').text((user_balance).formatMoney(2,'.',','));

                var tileIndex = parseInt($(this).attr("data-tile"));
                $(this).addClass("tileLoading");
                $(this).html("<div class=\"ui active loader\"></div>");

                var wager = (game.stake*100);
                console.log("[BET] Game:", game);
                
                var rangeWin = Math.floor(Math.pow(2,32)*(game.odds));

                game.tilesClicked++;
                var self = $(this);
                // 
                // winProb * profitIfWin + (1-winProb) * profitIfLose = EV
                // 
                $.ajax({
                    type: "POST",
                    contentType: "application/json",
                    url: "https://api.moneypot.com/v1/bets/custom?access_token="+access_token,
                    data: JSON.stringify({
                        client_seed: parseInt(game.clientSeed),
                        hash: String(Hash),
                        wager: wager,
                        "payouts": [
                            {from: 0, to: rangeWin, value: ((game.stake+game.next)*100)},
                            {from: rangeWin, to: Math.pow(2,32), value: 0}
                        ]
                    }),
                    dataType: "json",
                    error: function(xhr, status, error) {
                        console.error("[BET ERROR]",xhr.responseText);
                    }
                }).done(function(data){
                    self.removeClass("tileLoading");
                    console.log("[BET RESULT]", data);
                    if(data.next_hash){
                        console.log("[Provably fair] new hash: "+data.next_hash);
                        Hash = data.next_hash;

                        if(data.outcome >= rangeWin){
                            if(!audioMuted){
                                new Audio("lib/audio/mine.mp3").play();
                            }

                            self.addClass("pressed");
                            self.addClass("bomb reveal");
                            self.html("<i class=\"icon-alert warning icon\"></i>");

                            $('#logs').html("<div class=\"log_item\" style=\"border-left: 4px solid #E74C3C;\">Clicked tile #"+ndx+"<br>Found: <span style=\"color: #E74C3C\">Bomb</span>! <button id=\"playAgainButton\">Play Again</button><div class=\"info\"><a href=\"https://www.moneypot.com/bets/"+data.id+"\" target=\"_blank\"><i class=\"info circle icon\"></i></a></div></div>"+$('#logs').html());

                            $("#playAgainButton").click(function(){
                                $("#playAgainButton").remove();
                                $("#board").html(boardHtml);
                                $("#customBombs").val(game.bombs);
                                $("#startNewGameButton").click(function(){startNewGame();});
                                $("#bombsButtons .button").each(function(index){
                                    $(this).click(function(){
                                        $("#bombsButtons .button").each(function(){
                                            $(this).removeClass("active");
                                        });
                                        $(this).addClass("active");
                                        if(index===0){game.bombs = 1;}
                                        else if(index===1){game.bombs = 3;}
                                        else if(index===2){game.bombs = 5;}
                                        else if(index===3){game.bombs = 24;}
                                        else if(index===4){game.bombs = parseInt($('#customBombs').val());}

                                        if($(this).hasClass('customBombsButton')){
                                            $('#customBombsInputArea').css("display", "inline-flex");
                                        }else{
                                            $('#customBombsInputArea').css("display", "none");
                                        }
                                    });
                                });

                                game = {
                                    status: "ENDED",
                                    profit: game.stake,
                                    bet: parseInt(betSave),
                                    bombs: game.bombs,
                                    clientSeed: game.clientSeed,
                                    tilesClicked: 0,
                                    odds: 0,
                                    next: 0,
                                    stake: 0
                                };
                                $('#bet').val(game.bet);
                            });

                            if(game.bombs>1){
                                for(var i=0; i<game.bombs-1; i++){
                                    var indexes = [];
                                    $('.tile').each(function(index){
                                        if(!$(this).hasClass("pressed") && !$(this).hasClass("reveal")){
                                            indexes.push(index);
                                        }
                                    });
                                    roll = Math.floor(Math.random() * indexes.length) + 1;
                                    $(".tile:eq("+(indexes[roll-1])+")").addClass("reveal").html("<i class=\"icon-alert warning icon\"></i>");
                                }
                            }

                            $('#cashoutButton').css("display", "none");
                            game = {
                                status: "ENDED",
                                profit: (0-parseInt($("#bet").val())),
                                bet: parseInt(betSave),
                                bombs: game.bombs,
                                clientSeed: game.clientSeed,
                                tilesClicked: 0,
                                odds: 0,
                                next: 0,
                                stake: 0
                            }
                            $('#next_value').text(parseFloat(game.next).formatMoney(2,'.',','));
                            $('#stake_value').text(parseFloat(game.stake).formatMoney(2,'.',','));
                            $('.log_item').each(function(index){
                                if(index>5) $(this).remove();
                            });
                            console.log(game);
                            $(".settingsButon").css("display", "inline-block");
                        }else{
                            self.addClass("pressed");
                            self.html("<span class=\"tile_val\">+"+(parseFloat(game.next).formatMoney(2,'.',','))+"</span>");

                            $('#logs').html("<div class=\"log_item\" style=\"border-left: 4px solid #8D4;\">Clicked tile #"+ndx+"<br>Found: <span style=\"color: #8D4\">"+(parseFloat(game.next).formatMoney(2,'.',','))+"</span> Bits!<div class=\"info\"><a href=\"https://www.moneypot.com/bets/"+data.id+"\" target=\"_blank\"><i class=\"info circle icon\"></i></a></div></div>"+$('#logs').html());

                            user_balance += game.next+game.stake;
                            $('#balance').text((user_balance).formatMoney(2,'.',','));

                            houseEdge = 0.0050;
                            odds = ( (25.1-game.bombs-game.tilesClicked) / (25-game.tilesClicked) );
                            next = ( (game.bet+game.next) * ((1.0-houseEdge)/odds) ) - (game.bet+game.next);
                            game = {
                                status: "IN_PROGRESS",
                                profit: 0,
                                bet: game.bet+game.next,
                                bombs: game.bombs,
                                clientSeed: game.clientSeed,
                                tilesClicked: game.tilesClicked,
                                odds: odds,
                                next: next,
                                stake: game.bet+game.next
                            };
                            $('#next_value').text(parseFloat(game.next).formatMoney(2,'.',','));
                            $('#stake_value').text(parseFloat(game.stake).formatMoney(2,'.',','));
                            $('.log_item').each(function(index){
                                if(index>5) $(this).remove();
                            });
                            console.log(game);
                        }

                    }else{
                        console.log("BET ERROR: "+JSON.stringify(data.responseJSON));
                        $(".settingsButon").css("display", "inline-block");
                    }
                });
            });
        });

        console.log(
            "~~ New game ~~\n", game
        );

        $("#game_log").css("display", "inline-block");
        $("#highRoller_log").css("top", "475px");
        $(this).css("display", "inline-block");

    }, 'json');
}

$("#startNewGameButton").click(function(){startNewGame();});

$('#cashoutButton').click(function(){
    $(this).css("display", "none");
    $('#logs').html("<div class=\"log_item\" style=\"border-left: 4px solid #F39C12;\">Cashed out!<br>Profit: <span style=\"color: #F39C12\">"+(parseFloat(game.stake).formatMoney(2,'.',','))+"</span> Bits!</div>"+$('#logs').html());

    $("#board").html(boardHtml);
    $("#customBombs").val(game.bombs);
    $("#startNewGameButton").click(function(){startNewGame();});
    $("#bombsButtons .button").each(function(index){
        $(this).click(function(){
            $("#bombsButtons .button").each(function(){
                $(this).removeClass("active");
            });
            $(this).addClass("active");
            if(index===0){game.bombs = 1;}
            else if(index===1){game.bombs = 3;}
            else if(index===2){game.bombs = 5;}
            else if(index===3){game.bombs = 24;}
            else if(index===4){game.bombs = parseInt($('#customBombs').val());}

            if($(this).hasClass('customBombsButton')){
                $('#customBombsInputArea').css("display", "inline-flex");
            }else{
                $('#customBombsInputArea').css("display", "none");
            }
        });
    });

    game = {
        status: "ENDED",
        profit: (0-parseInt($("#bet").val())),
        bet: parseInt(betSave),
        bombs: game.bombs,
        clientSeed: game.clientSeed,
        tilesClicked: 0,
        odds: 0,
        next: 0,
        stake: 0
    }
    
    $('#next_value').text(parseFloat(game.next).formatMoney(2,'.',','));
    $('#stake_value').text(parseFloat(game.stake).formatMoney(2,'.',','));
    $('.log_item').each(function(index){
        if(index>5) $(this).remove();
    });
    console.log(game);
    $(".settingsButon").css("display", "inline-block");
});

function showSettings(){
    $('#theDimmer').html("<label style=\"color:white;\">Bet:</label><input class=\"bet\" type=\"number\" pattern=\"[0-9]*\" value=\""+betSave+"\" onkeyup=\"setBet($(this).val());\" onchange=\"setBet($(this).val());\" style=\"color:black;width:150px;\"><br>"+
                        "<label style=\"color:white;\">Bombs:</label><input class=\"bet\" type=\"number\" pattern=\"[0-9]*\" value=\""+game.bombs+"\" onkeyup=\"setBombs($(this).val());\" onchange=\"setBombs($(this).val());\" style=\"color:black;width:150px;\"><br>"+
                        "<label style=\"color:white;\">Client Seed:</label><input class=\"bet\" type=\"number\" pattern=\"[0-9]*\" value=\""+game.clientSeed+"\" onkeyup=\"setClientSeed($(this).val());\" onchange=\"setClientSeed($(this).val());\" style=\"color:black;width:150px;\">");
    $('#game_left').dimmer('show');
    return;
}

function tipUser(username, amount){
    $.ajax({
        type: "POST",
        contentType: "application/json",
        url: "https://api.moneypot.com/v1/tip?access_token="+getURLParameter('access_token'),
        data: JSON.stringify({
            "uname": username,
            "amount": Math.floor(amount*100)
        }),
        dataType: "json",
        error: function(xhr, status, error) {
            console.error("[TIP ERROR]", xhr.responseText);
            addNewChatMessage({
                created_at: (new Date()).getTime().toISOString(),
                text: "Error when sending tip to "+username+": "+xhr.responseText.error
            });
        }
    }).done(function(data){
        if(data.id){
            socket.emit('new_message', {
                text: "!tip "+data.to+" "+amount
            }, function(err, msg){
                if (err) {
                    console.log('Error when submitting new_message to server:', err);
                    return;
                }
                console.log('Successfully submitted message:', msg);
            });
            user_balance = (user_balance-amount);
            $('#balance').text((user_balance).formatMoney(2,'.',','));
        }else{
            addNewChatMessage({
                created_at: (new Date()).getTime().toISOString(),
                text: "Error when sending tip to "+username+": "+data
            });
        }
    });
}

$(document).keypress(function(e) {
    if(e.which == 32 && $('input:focus').length <= 0) {
        if(game.status == "IN_PROGRESS"){
            $("#cashoutButton").css("display", "none");
            $('#logs').html("<div class=\"log_item\" style=\"border-left: 4px solid #F39C12;\">Cashed out!<br>Profit: <span style=\"color: #F39C12\">"+(parseFloat(game.stake).formatMoney(2,'.',','))+"</span> Bits!</div>"+$('#logs').html());
            $("#board").html(boardHtml);
            $("#customBombs").val(game.bombs);
            $("#startNewGameButton").click(function(){startNewGame();});
            $("#bombsButtons .button").each(function(index){
                $(this).click(function(){
                    $("#bombsButtons .button").each(function(){
                        $(this).removeClass("active");
                    });
                    $(this).addClass("active");
                    if(index===0){game.bombs = 1;}
                    else if(index===1){game.bombs = 3;}
                    else if(index===2){game.bombs = 5;}
                    else if(index===3){game.bombs = 24;}
                    else if(index===4){game.bombs = parseInt($('#customBombs').val());}

                    if($(this).hasClass('customBombsButton')){
                        $('#customBombsInputArea').css("display", "inline-flex");
                    }else{
                        $('#customBombsInputArea').css("display", "none");
                    }
                });
            });

            game = {
                status: "ENDED_AWAITING",
                profit: game.stake,
                bet: parseInt(betSave),
                bombs: game.bombs,
                clientSeed: game.clientSeed,
                tilesClicked: 0,
                odds: 0,
                next: 0,
                stake: 0
            };
            $('#bet').val(game.bet);
            $('#next_value').text(parseFloat(game.next).formatMoney(2,'.',','));
            $('#stake_value').text(parseFloat(game.stake).formatMoney(2,'.',','));
            $('.log_item').each(function(index){
                if(index>5) $(this).remove();
            });
            console.log(game);
            $(".settingsButon").css("display", "inline-block");
        }else{
            if(game.status=="?" || game.status=="ENDED_AWAITING"){
                startNewGame();
                return;
            }
            $("#playAgainButton").remove();
            $("#board").html(boardHtml);
            $("#customBombs").val(game.bombs);
            $("#startNewGameButton").click(function(){startNewGame();});
            $("#bombsButtons .button").each(function(index){
                $(this).click(function(){
                    $("#bombsButtons .button").each(function(){
                        $(this).removeClass("active");
                    });
                    $(this).addClass("active");
                    if(index===0){game.bombs = 1;}
                    else if(index===1){game.bombs = 3;}
                    else if(index===2){game.bombs = 5;}
                    else if(index===3){game.bombs = 24;}
                    else if(index===4){game.bombs = parseInt($('#customBombs').val());}

                    if($(this).hasClass('customBombsButton')){
                        $('#customBombsInputArea').css("display", "inline-flex");
                    }else{
                        $('#customBombsInputArea').css("display", "none");
                    }
                });
            });

            game = {
                status: "ENDED_AWAITING",
                profit: game.stake,
                bet: parseInt(betSave),
                bombs: game.bombs,
                clientSeed: game.clientSeed,
                tilesClicked: 0,
                odds: 0,
                next: 0,
                stake: 0
            };
            $('#bet').val(game.bet);
        }
    }
});
	
$('#balanceRefreshButton').click(function(){		
    $('#balanceRefreshIcon').addClass('loading');		
    $.getJSON("https://api.moneypot.com/v1/auth?access_token="+access_token, function(json){		
        $('#balanceRefreshIcon').removeClass('loading');		
        $('#balance').text((json.user.balance/100).formatMoney(2,'.',','));		
        user_balance = (json.user.balance/100);		
        addNewChatMessage({		
            created_at: (new Date()).toISOString(),		
            text: "Balance refreshed! Amount: "+((json.user.balance/100).formatMoney(2,'.',','))+" Bits"		
        });		
    });		
});

function escapeHTML(str) {
    str = str + "";
    var out = "";
    for(var i=0; i<str.length; i++) {
        if(str[i] === '<') {
            out += '&#60;';
        } else if(str[i] === '>') {
            out += '&#62;';
        } else if(str[i] === "'") {
            out += '&#39;'; 
        } else if(str[i] === '"') {
            out += '&#34;'; 
        } else if(str[i] === '%') {
            out += '&#37;';
        } else if(str[i] === '\\') {
            out += '&#92;';
        } else if(str[i] === '¢'){
            out += '&#162;';
        } else if(str[i] === '¼'){
            out += '&#188;';
        } else if(str[i] === '½'){
            out += '&#189;';
        } else if(str[i] === '¾'){
            out += '&#190;';
        } else if(str[i] === ';'){
            out += '&#59;';
        } else if(str[i] === '#'){
            out += '&#35;';
        } else if(str[i] === '&' && str[i+1] === '#'){
            out += '&#38;';
        } else {
            out += str[i];
        }
    }
    return out;
}
