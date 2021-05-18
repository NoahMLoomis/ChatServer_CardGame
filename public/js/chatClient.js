const $$ = (val) => document.querySelector(val);

// Create the type of element you pass in the parameters
const createNode = element =>  document.createElement(element); 

// Append the second parameter(el) to the first one (parent) in a parent-child relationship
const appendNode = (parent, el) => parent.appendChild(el); 
const startUp = $$('#chatBoard');
let isWaiting = false;
let gameInProgress = false;
let firstPlayerCount=0;
let cardBoard = document.querySelector("#cardBoard");
let trumpBoard = document.querySelector("#trumpBoard");


addEventListener('load', () => {
    let socket = io();

    
    socket.on("hi", msg => {
        let msgDisplay = createNode('p');
        msgDisplay.innerHTML = '>>>' + msg;
        appendNode(startUp, msgDisplay);
    });

    $$('#sendmsg').addEventListener('click', (e) => {
        socket.emit('chat', $$('#msg').value);
        $$('#msg').value="";
        e.preventDefault();
    })

    socket.on('chat', (msg, myCol) => {
        let msgDisplay = createNode('p');
        msgDisplay.style.color = myCol;
        msgDisplay.innerHTML = '' + msg ;
        appendNode(startUp, msgDisplay);
    });

    $$("#msgForm").style.display = "none";

    $$('#sendUsername').addEventListener('click', (e) => {
        if ($$("#username").value === "") {
            $$("#errorUsername").innerHTML = "Please enter a username";
        }else{
            $$("#play").hidden = false;
            $$("#chatBoard").hidden = false;
            $$("#errorUsername").innerHTML = "";
            $$("#userForm").hidden = true;
            $$("#msgForm").style.display = "inline";
            socket.emit("newConnect", $$('#username').value)
            $$('#username').value = "";
        }
        e.preventDefault();

    });

    socket.on('firstPlayer', () => {
        $$("#startGame").hidden = false;
        $$("#startGame").disabled = true;
    })

    $$("#play").addEventListener("click", () => {
        isWaiting=true;

        $$("#play").hidden = true;
        $$("#leave").hidden = false;
        socket.emit('queue');
    });

    socket.on('queue', (waitingCount) => {
        console.log("Waiting count is (in client)" + waitingCount);
        if (waitingCount >=2){
            $$("#startGame").disabled = false;
        }else{
            $$("#startGame").disabled = true;
        }
        $$("#waiting").hidden = false;
        $$("#numPlayersWaiting").hidden = false;
        if (!gameInProgress) {
            if (isWaiting) {
                $$("#isWaiting").innerHTML = "You are waiting ✔";
            } else {
                $$("#isWaiting").innerHTML = "You are not waiting X";
            }
        }else{
            $$("#isWaiting").innerHTML = "Game is in progress";
        }
            $$("#waitingNum").innerHTML = waitingCount;

    });

    $$("#leave").addEventListener('click', () => {
        isWaiting=false;
        $$("#play").hidden = false;
        $$("#leave").hidden = true;
        socket.emit('leave');
    })

    $$("#startGame").addEventListener('click', ()=> {
        $$("#startGame").hidden = true;
        if (isWaiting){
            socket.emit("joinGame");
        }
        socket.emit('startGame');
    })

    socket.on("leave", (waitingCount) => {
        if (isWaiting) {
            $$("#isWaiting").innerHTML = "You are waiting ✔";
        } else {
            $$("#isWaiting").innerHTML = "You are not waiting X";
        }
        $$("#waitingNum").innerHTML = waitingCount;
    })

    socket.on("cardPlayed", (order, type, user) => {
        let newCardVal = createNode('li');
        newCardVal.innerHTML = `  ${user}: ${order} of ${type}`;
        appendNode($$("#allCardsPlayed"), newCardVal);
    })


    socket.on("tooMany", () => {
        $$("#play").hidden = false;
        $$("#isWaiting").innerHTML = "Queue is full";
    })

    let clearBoard = () => {
        while (trumpBoard.firstChild)
            trumpBoard.removeChild(trumpBoard.lastChild);

        while (cardBoard.firstChild)
            cardBoard.removeChild(cardBoard.lastChild);
        }
    let playedCards=[];
    socket.on("deal", (hand, trump, user) => {

        clearBoard();
        let trumpCard = createNode('article');
        trumpCard.className = "trumpCard";
        trumpCard.innerHTML = `Trump is ${trump._type}`;
        appendNode($$("#trumpBoard"), trumpCard);

        console.log(playedCards);

        for (let i=0; i< hand.length; i++){
            playedCards.forEach(alreadyPlayedCard => {
                console.log(alreadyPlayedCard);
                if (hand[i] === alreadyPlayedCard) {
                    hand.pop();
                }
            })
        }

        hand.forEach( card => {
            let newCard = createNode('button');
            newCard.className = "singleCard";
            newCard.innerHTML = `${card._order} of ${card._type}`;
            newCard.disabled = true;
            newCard.addEventListener('click', (e) => {
                socket.emit('playCard', card._order, card._type, user, trump);
                disableAllCards();
                playedCards.push(`${card._order} of ${card._type}`);
            })
            appendNode($$("#cardBoard"), newCard);

        })
    })

    let disableAllCards = () => {
        document.querySelectorAll('.singleCard').forEach( btn => {
            btn.disabled = true;
        })
    }

    let enableAllCards = () => {
        document.querySelectorAll('.singleCard').forEach(btn => {
            btn.disabled = false;
        })
    }
    socket.on('playGame', () => {
        // $$("#play").hidden = true;
        $$("#waiting").hidden = true;
        $$("#leave").hidden = true;

    })

    socket.on('gameInProgress', () => {
        gameInProgress = true;
        $$("#play").hidden = true;
        $$("#isWaiting").innerHTML = "Game is progress";
    })

    socket.on('yourTurn', () => {
        console.log('MY TURN')
        enableAllCards()
    })

    socket.on("trickOver", msg => {
        $$("#winLoss").innerHTML = msg;
        $$('#allCardsPlayed').innerHTML = "";
        setTimeout( () => {
            $$("#winLoss").innerHTML="";
        }, 2000)
    })

    socket.on("gameOver", msg => {
        console.log("Game is over in the client! " + msg);
        $$("#winLoss").innerHTML = msg;
        setTimeout( () => {
            clearBoard();
            $$("#waiting").hidden = false;
            gameInProgress = false;
            $$("#play").hidden = false;
            $$("#isWaiting").innerHTML = "";
            $$("#numPlayersWaiting").hidden = true;
            $$("#waitingNum").innerHTML ="";
        }, 2000)
        socket.emit('gameOver');
    })



});