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
var betSave = 2;

var game = {
    status: "?",
    profit: 0,
    bet: 2,
    bombs: 3,
    tilesClicked: 0,
    odds: 0,
    next: 0,
    stake: 0
}

function setBet(x){
    game.bet =  Math.floor(parseFloat(x));
    betSave = game.bet;
}

function setBombs(x){
    if(x > 0 && x < 24) game.bomb = parseInt(x);
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
    
    var loadeText = jQuery('<div/>', {
        id:     'loaderText',
        class:  'ui text loader',
        text:   'Connecting'
    }).appendTo(loaderDimmer);

    // https://blog.moneypot.com/introducing-socketpot/
    socket = io('https://socket.moneypot.com');
    var config = {
        app_id: 584,
        access_token: ((getURLParameter('access_token')!="" && getURLParameter('access_token')!=null)?getURLParameter('access_token'):undefined),
        subscriptions: ['CHAT', 'DEPOSITS']
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
            if(getURLParameter('access_token')!="" && getURLParameter('access_token')!=null){
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
                
                $.getJSON("https://api.moneypot.com/v1/token?access_token="+getURLParameter('access_token'), function(json){
                    $('#connectionText').css('display', 'block');
                    $('#betPanel').css('display', 'block');
                    $('#depositButton').css('display', "inline-block");
                    $('#withdrawButton').css('display', "inline-block");
                    $('#username').text(json.auth.user.uname);
                    $('#balance').text((json.auth.user.balance/100).formatMoney(2,'.',','));
                    user_balance = (json.auth.user.balance/100);
                    $.post("https://api.moneypot.com/v1/hashes?access_token="+getURLParameter('access_token'), '', function(json) {
                        console.log("[Provably fair] We received our first hash: "+json.hash);
                        Hash = json.hash;
                    }, 'json');
                });
                
                console.log(authData);
            }
            
            users = ObjectLength(authData.chat.userlist);
            $("#connectedUsersAmount").text(users);
            
            for(var i=0; i<authData.chat.messages.length; i++){
                addNewChatMessage(authData.chat.messages[i]);
            }
        });
    });

    socket.on('disconnect', function() {
        console.warn('[socketpot] disconnected');
        document.getElementById("chatMonitor").innerHTML = "";
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
    });
    socket.on('reconnecting', function() {
        console.warn('[socketpot] attempting to reconnect...');
        $('#loaderContainer').css('display', 'block');
        $('#loaderText').text('Reconnecting');
    });
    socket.on('reconnect', function() {
        console.info('[socketpot] successfully reconnected');
        $('#loaderContainer').css('display', 'none');
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

    // balance updated
    socket.on('balance_change', function(payload) {
        $('#balance').text((payload.balance/100).formatMoney(2,'.',','));
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
        var username = data.user.uname;
        var rank = data.user.role;
    }else{
        var username = "Server";
        var rank = "server";
    }
    var date = {
        hours: addZero((new Date(data.created_at)).getHours()),
        mins: addZero((new Date(data.created_at)).getMinutes())
    }
    var message = data.text;
    
    var chatMonitor = document.getElementById("chatMonitor");
    var servStyle = (username=="Server"?"style='color:lime;font-weight:bold;'":"");
    var modStyle = ((rank=="MOD" || rank=="OWNER")?"style='color:red;'":"");
    chatMonitor.innerHTML += "<span class=\"chatMessage\" "+servStyle+"><small>"+date.hours+":"+date.mins+"</small> <b "+modStyle+">"+username+"</b>: "+message+"<br></span>";
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
    var windowUrl = 'https://www.moneypot.com/dialog/deposit?app_id=584';
    var windowName = 'manage-auth';
    var windowOpts = 'width=420,height=350,left=100,top=100';
    var windowRef = window.open(windowUrl, windowName, windowOpts);
    windowRef.focus();
});

$('#withdrawButton').click(function() {
    var windowUrl = 'https://www.moneypot.com/dialog/withdraw?app_id=584';
    var windowName = 'manage-auth';
    var windowOpts = 'width=420,height=350,left=100,top=100';
    var windowRef = window.open(windowUrl, windowName, windowOpts);
    windowRef.focus();
});

function onloadCallback() {
    grecaptcha.render('faucetClaimCaptcha', {
        'sitekey' : '6LfXmQwTAAAAANaHFH1Zv6EhYX3lZg3Rl5sOkruQ',
        'callback' : correctCaptcha
    });
};

function correctCaptcha(response) {
    $.ajax({
        type: "POST",
        contentType: "application/json",
        url: "https://api.moneypot.com/v1/claim-faucet?access_token="+getURLParameter('access_token'),
        data: JSON.stringify({
            "response": response
        }),
        dataType: "json"
    }).done(function(data) {
        console.log((data.amount/100)+" has been added to your balance!");
        $.get( "https://api.moneypot.com/v1/auth?access_token="+getURLParameter('access_token'), function( data ) {
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
            if(claimedTime+300000<=(new Date()).getTime()){
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
        else{game.bombs = 24;}
    });
});

var houseEdge = 0.99; // .99 = 1% for 24 bombs
function startNewGame(){
    houseEdge = 0.99;

    if(Hash == ""){
        $('#theDimmer').text("Error: Not connected!");
        $('#game_left').dimmer('show');
        return;
    }

    game.tilesClicked = 0;
    houseEdge = (100-(1/ ((25-game.bombs)-game.tilesClicked)))/100;
    game = {
        status: "IN_PROGRESS",
        profit: 0,
        bet: game.bet,
        bombs: game.bombs,
        tilesClicked: 0,
        odds: ( (25-game.bombs-game.tilesClicked) / (25-game.tilesClicked) ),
        next: ( (( houseEdge / ( ((25-game.bombs)-game.tilesClicked) / (25-game.tilesClicked) ) )*game.bet)-game.bet ),
        stake: game.bet
    };

    if(user_balance-game.bet<0){
        $('#theDimmer').text("Error: Not enough Balance!");
        $('#game_left').dimmer('show');

        game = {
            status: "ENDED",
            profit: game.stake,
            bet: parseInt($("#bet").val()),
            bombs: game.bombs,
            tilesClicked: 0,
            odds: 0,
            next: 0,
            stake: 0
        }

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

            var wager = (Math.floor(game.stake * 100) / 100)*100;
            console.log("[BET] Game:", game);
            
            // 0 to 4294967296 
            var rageLose = Math.round((4294967296/25)*(game.bombs+game.tilesClicked));

            game.tilesClicked++;
            var self = $(this);
            // 
            // winProb * profitIfWin + (1-winProb) * profitIfLose = EV
            // 
            $.ajax({
                type: "POST",
                contentType: "application/json",
                url: "https://api.moneypot.com/v1/bets/custom?access_token="+getURLParameter('access_token'),
                data: JSON.stringify({
                    client_seed: 12345,
                    hash: String(Hash),
                    wager: wager,
                    "payouts": [
                        {from: 0, to: rageLose, value: 0},
                        {from: rageLose, to: 4294967296, value: Math.floor((game.stake+game.next)*100)}
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

                    if(data.outcome < rageLose){
                        self.addClass("pressed");
                        self.addClass("bomb reveal");
                        self.html("<i class=\"icon-alert warning icon\"></i>");

                        $('#logs').html("<div class=\"log_item\" style=\"border-left: 4px solid #E74C3C;\">Clicked tile #"+ndx+"<br>Found: <span style=\"color: #E74C3C\">Bomb</span>! <button id=\"playAgainButton\">Play Again</button><div class=\"info\"><a href=\"https://www.moneypot.com/bets/"+data.id+"\" target=\"_blank\"><i class=\"info circle icon\"></i></a></div></div>"+$('#logs').html());

                        $("#playAgainButton").click(function(){
                            $("#playAgainButton").remove();
                            $("#board").html(boardHtml);
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
                                    else{game.bombs = 24;}
                                });
                            });

                            game = {
                                status: "ENDED",
                                profit: game.stake,
                                bet: parseInt(betSave),
                                bombs: game.bombs,
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
                    }else{

                        self.addClass("pressed");
                        self.html("<span class=\"tile_val\">+"+(parseFloat(game.next).formatMoney(2,'.',','))+"</span>");

                        $('#logs').html("<div class=\"log_item\" style=\"border-left: 4px solid #8D4;\">Clicked tile #"+ndx+"<br>Found: <span style=\"color: #8D4\">"+(parseFloat(game.next).formatMoney(2,'.',','))+"</span> Bits!<div class=\"info\"><a href=\"https://www.moneypot.com/bets/"+data.id+"\" target=\"_blank\"><i class=\"info circle icon\"></i></a></div></div>"+$('#logs').html());

                        user_balance += game.next+game.stake;
                        $('#balance').text((user_balance).formatMoney(2,'.',','));

                        houseEdge = (100-(1/ ((25-game.bombs)-game.tilesClicked)))/100;
                        game = {
                            status: "IN_PROGRESS",
                            profit: 0,
                            bet: game.bet+game.next,
                            bombs: game.bombs,
                            tilesClicked: game.tilesClicked,
                            odds: ( (25-game.bombs-game.tilesClicked) / (25-game.tilesClicked) ),
                            next: ( (( houseEdge / ( (25-game.bombs-game.tilesClicked) / (25-game.tilesClicked) ) )*game.stake)-game.stake ),
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
                }
            });
        });
    });

    console.log(
        "~~ New game ~~\n", game
    );

    $("#game_log").css("display", "inline-block");
    $(this).css("display", "inline-block");
}

$("#startNewGameButton").click(function(){startNewGame();});

$('#cashoutButton').click(function(){
    $(this).css("display", "none");
    $('#logs').html("<div class=\"log_item\" style=\"border-left: 4px solid #F39C12;\">Cashed out!<br>Profit: <span style=\"color: #F39C12\">"+(parseFloat(game.stake).formatMoney(2,'.',','))+"</span> Bits!</div>"+$('#logs').html());

    $("#board").html(boardHtml);
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
            else{game.bombs = 24;}
        });
    });

    game = {
        status: "ENDED",
        profit: game.stake,
        bet: parseInt(betSave),
        bombs: game.bombs,
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
});

