const path = require('path');
const app = require("express")();
const http = require('http').Server(app);
const io = require("socket.io")(http);
const fs = require('fs').promises;
let d = new Date();
let formattedDate =`${d.getUTCFullYear()}/${d.getUTCMonth()+1}/${d.getUTCDate()} ${d.getUTCHours()}:${d.getUTCMinutes()}:${d.getUTCSeconds()}`;

const PORT = 3000;
const WEBROOT = 'public';
let userArray = [];
let gameUserArray=[];
let myCol ="";
let roundCards=[];
let waitingCount=0;
let usersPlayed=[];
let randIndexPlayer;
let cardsPlayedCount;
let roundCount;
let myDeck;
let fullDeck;


class User{
    constructor(socket, wins, name) {
        this._socket = socket;
        this._wins = wins;
    }
}


class Card {
    constructor(type, order, faceUp = false) {
        this._type = type;
        this._order = order;
        this._faceUp = faceUp;
    }

    flipCard(){
        this._faceUp = !this._faceUp;
    }
}

class Deck {
    constructor(deckNum) {
        this.cards = [];
        this.dealtCards = [];
        this._deckNum = deckNum;
        this.fullDeck = this.cards;
    }


    deal(){
        this.cardToDeal = this.cards.pop();
        this.cardToDeal._faceUp = !this.cardToDeal._faceUp;

        this.dealtCards.push(this.cardToDeal);
        return this.cardToDeal;
    }


    dealHand(){
        this.singleHand=[];
        for (let i=0; i<9; i++){
            this.singleHand.push(this.deal());
        }
        return this.singleHand;
    }

    getCards(){
        return this.cards;
    }

    shuffle(){
        let length = this.cards.length;
        for (let i=0; i< 12; i++){
            for (let j=length -1; j>=0; j-- ){
                this.rand = Math.floor(Math.random() * (length ));
                this.temp = this.cards[j];
                this.cards[j] = this.cards[this.rand];
                this.cards[this.rand] = this.temp;
            }
        }
    }


}

let uniqueColor = () => {
    return "#" +Math.floor(Math.random()*16777215).toString(16);
}

let logInfo = (logStr) => {
    let currDate = new Date();
    let dateStr = `${currDate.getUTCFullYear()}${currDate.getUTCMonth()+1}${currDate.getUTCDate()}`
    let outLog = `${d}, ${logStr}\n`;
    fs.appendFile(`./logs/${dateStr}Events.log`, outLog)
        .then()
        .catch(e => {
            // res.end("Something went wrong" + e);
            process.exit(1);
        })
}

//If there is no url specified
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, WEBROOT, 'chat.html'));
})

app.get('/*', (req, res) => {
    if (path.parse(req.url).base !== 'favicon.ico')
        res.sendFile(path.join(__dirname, WEBROOT, path.parse(req.url).dir, path.parse(req.url).base))
})

io.on('connection', socket => {

    myCol = uniqueColor();
    
    let addr = socket.handshake;

    
    socket.on("disconnect", () => {
        delete gameUserArray[socket.id];
        delete userArray[socket.id];
    })

    socket.on('chat', (msg) => {

        if (msg.charAt(0) === "!") {
            let spaceIndex = msg.indexOf(" ");
            let destinationUser = msg.slice(1, spaceIndex);
            let newMsg = msg.replace(`!${destinationUser}`, "");
            let socketIdTarget = Object.keys(userArray).find(k => userArray[k] === destinationUser);
            io.to(socketIdTarget).emit('chat',  `PRIVATE ${userArray[socket.id]} >>> ${newMsg}`, userArray.color);
            logInfo(`msg Length is ${msg.length} to ${destinationUser}` )
        }else{
            io.emit('chat', `${userArray[socket.id]} >>> ${msg}`, userArray.color);
            logInfo("msg Length is " + msg.length);
        }

    })

    socket.on("newConnect", newName => {
        logInfo(newName);
        userArray[socket.id] = newName;
        userArray.color = uniqueColor();
        socket.emit("hi", "Hello there " + userArray[socket.id]  + `, there are currently ${io.engine.clientsCount} connections`)

    })

    socket.on('queue', () => {

        waitingCount++

        console.log("Waiting count is " + waitingCount);

        if (waitingCount === 1 ){
            gameUserArray.push(new User(socket.id, 0));
            console.log("Game userArr")
            console.log(gameUserArray);

            socket.emit('firstPlayer');
            io.emit('queue', waitingCount);
        }else if (waitingCount >6){
            socket.emit('tooMany');
        }else{
            gameUserArray.push(new User(socket.id, 0));
            io.emit('queue', waitingCount);
        }
    });

    socket.on("leave", () => {
        waitingCount--;
        io.emit("leave", waitingCount);
    })

    socket.on('startGame', () => {

        roundCount=0;
        let randSet = Math.floor(Math.random() * (5) + 1);
        myDeck = new Deck(randSet);
        let setPath = `./sets/${randSet}.json`;
        fs.access(setPath)
            .then( () => {
                fs.readFile(setPath)
                    .then( contents => JSON.parse(contents))
                    .then( (parsed) =>{
                            parsed.type.forEach(t => {
                                parsed.order.forEach(o => {
                                    myDeck.cards.push(new Card(t, o));
                                })
                            })
                            fullDeck = myDeck;
                            myDeck.shuffle();
                            return myDeck
                }).then( (deck) =>{
                    resetHands();
                    playRound();
                }).catch( e => {
                        console.log("Error with readFile" + e);
                    });
            }).catch( e => {
            console.log("Error with access" + e);
        })
    })
    let resetHands = () => {

        let trump = myDeck.deal();
        trump.flipCard()
        console.log("Cards is")
        console.log(myDeck.cards);
        console.log("Dealth cards is")
        console.log(myDeck.dealtCards);
        gameUserArray.forEach( user => {
            io.emit('gameInProgress');
            io.to(user._socket).emit('playGame');
            io.to(user._socket).emit('deal', myDeck.dealHand(), trump, user);
        })
    }

    let playRound = () => {
        roundCount++;
        if (roundCount <=9) {
            roundCards = [];
            usersPlayed = [];
            cardsPlayedCount = 0;
            //TODO harcoded for testing
            randIndexPlayer = 0;
            // randIndexPlayer = Math.floor((Math.random() * gameUserArray.length));
            // console.log('gameUserArray.length is ' + gameUserArray.length);
            usersPlayed.push(randIndexPlayer);
            io.to(gameUserArray[randIndexPlayer]._socket).emit('yourTurn')
        }else{
            let winningUser=null;
            console.log(gameUserArray);
            //TODO tie game
            gameUserArray.forEach( user=> {
                for (let i=1; i< gameUserArray.length; i++){
                    if (user._wins < gameUserArray[i]._wins){
                        winningUser = gameUserArray[i];
                    }else if (user._wins >= gameUserArray[i]._wins){
                        winningUser = user;
                    }
                }
            })
            gameUserArray.forEach(user => {
                if (user._socket === winningUser._socket){
                    io.to(user._socket).emit('gameOver', "You won!!!!")
                }else{
                    io.to(user._socket).emit('gameOver', "Better luck next time!")
                }
            })
        }
    }

    socket.on('gameOver', () => {
        //TODO: Clear queue, reset all values
        waitingCount=0;
        gameUserArray=[];
    })


    //TODO BUG WHEN TRUMP CARD IS PLAYED FOR SECOND PLAYERs
    socket.on("playCard", (order, type, user, trump) => {
        let firstCardPlayed;
        if (roundCards.length === 0){
            firstCardPlayed = type;
        }

        cardsPlayedCount++;
        roundCards.push({
            _order: order,
            _type: type,
            user: user,
            trump: trump,
            firstCardPlayed: firstCardPlayed
        });
        randIndexPlayer++;
        //TODO bug with going to next player
        //Insert a count to keep track of how many cards have been played?
        if (cardsPlayedCount <gameUserArray.length){
            if (randIndexPlayer >= gameUserArray.length){
                randIndexPlayer = 0;
            }else {
                gameUserArray.forEach( user => {
                    io.to(user._socket).emit('cardPlayed', order, type, userArray[socket.id]);
                })
                io.to(gameUserArray[randIndexPlayer]._socket).emit('yourTurn');
            }
        }else{
            gameUserArray.forEach( user => {
                if (user._socket === determineTrickWinner(trump, firstCardPlayed)._socket){
                    user._wins += 1;
                    io.to(user._socket).emit("trickOver", `You won the trick`);
                }else{
                    io.to(user._socket).emit("trickOver", "You lost the trick");
                }
            });
            let cardStr="";
             roundCards.forEach( card => {
                 cardStr+= `${card._order} of ${card._type}, `;
             })
            logInfo(`cards played are ${cardStr}, winner is ${userArray[determineTrickWinner(trump, firstCardPlayed)._socket]}`);
            playRound();
        }
    })

    let determineTrickWinner = (trump) => {
        let trumpTypePlayed=false;
        let highestCard;
        roundCards.forEach( cardPlayed => {
            if (cardPlayed._type === trump._type){
                trumpTypePlayed = true;
            }
        });
        if (trumpTypePlayed){
            for (let i=0; i< roundCards.length; i++){
                for (let j=1; j<roundCards.length; j++){
                    if (roundCards[i]._type === trump._type){
                        if (roundCards[i]._order > roundCards[j]._order){
                            highestCard = roundCards[i];
                        }else if (roundCards[i]._order <= roundCards[j]._order){
                            highestCard = roundCards[j];
                        }
                    }
                }

            }

        }else{
            for (let i=0; i< roundCards.length; i++){
                for (let j=1; j<roundCards.length; j++){
                    if (roundCards[i]._type === roundCards[i].firstCardPlayed){
                        if (roundCards[i]._order > roundCards[j]._order){
                            highestCard = roundCards[i];
                        }else if (roundCards[i]._order <= roundCards[j]._order){
                            highestCard = roundCards[j];
                        }
                    }
                }

            }
        }
        return highestCard.user;
    }
})


http.listen(PORT, () => {
    console.log(`Chat server running on port: ${PORT}`);
})


