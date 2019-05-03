var mnemonic = 'candy maple cake sugar pudding cream honey rich smooth crumble sweet treat';

// Import the page's CSS. Webpack will know what to do with it.
import "../stylesheets/app.css";

// Import libraries we need.
import { default as Web3} from 'web3';
import { default as contract } from 'truffle-contract'
import HDWalletProvider from 'truffle-hdwallet-provider';
import $ from 'jquery'

// Import our contract artifacts and turn them into usable abstractions.
import regulator_artifacts from '../../build/contracts/Regulator.json'
import tollboothoperator_artifacts from '../../build/contracts/TollBoothOperator.json'

var Regulator = contract(regulator_artifacts);
var TollBoothOperator = contract(tollboothoperator_artifacts);
var Operators = [];
var Tollbooths = [];
var enterExit = [];
//Switch mnemonic here to match funded accounts on private ethereum chain

// The following code is simple to show off interacting with your contracts.
// As your needs grow you will likely need to change its form and structure.
// For application bootstrapping, check out window.addEventListener below.
var accounts;
var regulatorAccount;
var operatorAccount;
var vehicleAccount;
var tollboothAccount;

window.App = {
  start: function() {
    var self = this;

    var provider = new HDWalletProvider(mnemonic, 'http://localhost:8545', 0, 5);
    console.log(provider);
    Regulator.setProvider(provider);
    web3.setProvider(provider);
    // Get the initial account balance so it can be displayed.
    web3.eth.getAccounts(function(err, accs) {
      if (err != null) {
        // alert(err);
        // alert("There was an error fetching your accounts.");
        return;
      }

      if (accs.length === 0) {
        alert("Couldn't get any accounts! Make sure your Ethereum client is configured correctly.");
        return;
      }

      accounts = accs;
      regulatorAccount = accounts[0];
      $('.js-regulatorAddress').html(regulatorAccount);
      console.log('prebalance');
      self.getBalance(0);
      operatorAccount = accounts[1];
      $('.js-operatorAddress').html(operatorAccount);
      self.getBalance(1);
      vehicleAccount = accounts[2];
      $('.js-vehicleAddress').html(vehicleAccount);
      self.getBalance(2);
      tollboothAccount = accounts[3];
      $('.js-tollboothAddress').html(tollboothAccount);
      self.getBalance(3);
      console.log(accounts);
    });
  },

  getBalance: function( ind ) {

    return web3.eth.getBalance(accounts[ind], function (error, result) {
      if (!error) {
        switch(ind) {
          case 0:
            $('.js-regulatorBalance').html(web3.fromWei(result.toNumber()) + ' ether');;
            break;
          case 1:
            $('.js-operatorBalance').html(web3.fromWei(result.toNumber()) + ' ether');;
            break;
          case 2:
            $('#balanceeth').html(web3.fromWei(result.toNumber()) + ' ether');;
            break;
          case 3:
            $('.js-tollboothBalance').html(web3.fromWei(result.toNumber()) + ' ether');;
            break;
        }
        console.log(result.toNumber());
      } else {
        console.error(error);
      }
    })
  },

  openPage: function(pageName, elmnt, color) {
        // Hide all elements with class="tabcontent" by default */
        var i, tabcontent, tablinks;
        tabcontent = document.getElementsByClassName("tabcontent");
        for (i = 0; i < tabcontent.length; i++) {
            tabcontent[i].style.display = "none";
        }

        // Remove the background color of all tablinks/buttons
        tablinks = document.getElementsByClassName("tablink");
        for (i = 0; i < tablinks.length; i++) {
            tablinks[i].style.backgroundColor = "";
        }

        // Show the specific tab content
        document.getElementById(pageName).style.display = "block";

        // Add the specific color to the button used to open the tab content
        elmnt.style.backgroundColor = color;
  },

  enterExitHistory: function() {
    $('#enterexithistory').html('');
    for (var i = 0; i < enterExit.length; i++) {
      if (enterExit[i].vehicle === accounts[2]) {
        $('#enterexithistory').append(JSON.stringify(enterExit[i]));
      }
    }
   },

  setVehicleType: function() {
    var self = this;
    var regulator;
    var vehicleAddress = $('#vehicleType-address').val();
    console.log(vehicleAddress);
    var vehicleType = $('#vehicleType-type').val();
    console.log(vehicleType);
    console.log(window.web3);
    Regulator.deployed().then(function(instance) {
      regulator = instance;
      console.log(regulatorAccount);
      return regulator.setVehicleType.call(vehicleAddress, vehicleType, { from: regulatorAccount, gas: 4712388 });
    }).then(function(e) {
      if (e === false) {
        console.log(e);
        $('#error').html(e);
      }
      else {
        return regulator.setVehicleType(vehicleAddress, vehicleType, { from: regulatorAccount, gas: 4712388 });
      }
    }).then(function(tx) {
      console.log(tx);
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error setting vehicle type; see log.");
    });
  },

  createNewOperator: function() {
    var self = this;
    var regulator;
    var owner = $('#newOperator-owner').val();
    var deposit = $('#newOperator-deposit').val();
    Regulator.deployed().then(function(instance){
      regulator = instance;

      return regulator.createNewOperator.call(owner, deposit, {from: regulatorAccount, gas: 4712388 });
    }).then(function(e){
      if(e) {
        return regulator.createNewOperator(owner, deposit, {from: regulatorAccount, gas: 4712388 });
      }
    }).then(function(tx) {
        console.log(tx);
        TollBoothOperator.setProvider(web3.currentProvider);
        TollBoothOperator.at(tx.logs[1].args.newOperator).then(function(instance) {
          console.log(instance);
          $('.tollboothOperator-address').val(tx.logs[1].args.newOperator);
          //return instance.setPaused(false, {from: account});
        });
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error setting new operator; see log.");
    });
  },

  addTollBooth: function() {
    var self = this;
    let tollBoothOperator;
    var contractAddress = $('#addTollbooth-contractAddress').val();
    var isPaused;
    console.log(contractAddress);
    var address = $('#addTollbooth-address').val();
    TollBoothOperator.at(contractAddress).then(function(instance) {
      console.log(instance);
      tollBoothOperator = instance;
      return tollBoothOperator.isPaused.call({from: operatorAccount });
    }).then(function(paused){
      isPaused = paused;
      if (isPaused) {
        console.log(isPaused);
        tollBoothOperator.setPaused.call(false, {from: operatorAccount }).then(function(e){
          if (e) {
            return tollBoothOperator.setPaused(false, {from: operatorAccount, gas: 4712388 });
          }
        });
      }
      return tollBoothOperator.addTollBooth.call(address, {from: operatorAccount });
    }).then(function(e){
      if (e) {
        return tollBoothOperator.addTollBooth(address, {from: operatorAccount, gas: 4712388 });
      }
    }).then(function(tx) {
      console.log(tx);
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error adding tollbooth; see log.");
    });
  },

  setRoutePrice: function() {
    var self = this;
    var tollBoothOperator;
    var contractAddress = $('#setRoutePrice-contractAddress').val();
    var entryAddress = $('#setRoutePrice-entryAddress').val();
    var exitAddress = $('#setRoutePrice-exitAddress').val();
    var priceWeis = $('#setRoutePrice-contractAddress').val();
    TollBoothOperator.at(contractAddress).then(function(instance) {
      tollBoothOperator = instance;

      return tollBoothOperator.setRoutePrice.call(entryAddress, exitAddress, priceWeis, {from: operatorAccount });
    }).then(function(e){
      if(e) {
        return tollBoothOperator.setRoutePrice(entryAddress, exitAddress, priceWeis, {from: operatorAccount, gas: 4712388 });
      }
    }).then(function(tx) {
        console.log(tx);
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error setting route price; see log.");
    });
  },

  setMultiplier: function() {
    var self = this;
    var tollBoothOperator;
    var contractAddress = $('#setMultiplier-contractAddress').val();
    var vehicleType = $('#setMultiplier-vehicleType').val();
    var multiplier = $('#setMultiplier-multiplier').val();
    TollBoothOperator.at(contractAddress).then(function(instance) {
      tollBoothOperator = instance;
      return tollBoothOperator.setMultiplier.call(vehicleType, multiplier, {from: operatorAccount });
    }).then(function(e){
      if(e) {
        return tollBoothOperator.setMultiplier(vehicleType, multiplier, {from: operatorAccount, gas: 4712388 });
      }
    }).then(function(tx) {
      console.log(tx);
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error setting multiplier; see log.");
    });
  },

  enterRoad: function() {
    var self = this;
    var tollBoothOperator;
    var contractAddress = $('#enterRoad-contractAddress').val();
    var entryAddress = $('#enterRoad-entryAddress').val();
    var secretHashed = $('#enterRoad-secretHashed').val();

    TollBoothOperator.at(contractAddress).then(function(instance) {
      tollBoothOperator = instance;
      return tollBoothOperator.enterRoad.call(entryAddress, secretHashed, {from: vehicleAccount, value: 1000 });
    }).then(function(e){
      if(e) {
        return tollBoothOperator.enterRoad(entryAddress, secretHashed, {from: vehicleAccount, value: 1000, gas: 4712388 });
      }
    }).then(function(tx){
      console.log(tx);
      for (var i=0; i < tx.logs.length; i++) {
        if (tx.logs[i].event === 'LogRoadEntered') {
          var event = {
            booth: tx.logs[i].args.entryBooth,
            vehicle: tx.logs[i].args.vehicle,
            event: 'enter',
          }
          enterExit.push(event);
        }
      }
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error entering road; see log.");
    });
  },
  exitRoad: function() {
    var self = this;
    var tollBoothOperator;
    var contractAddress = $('#exitRoad-contractAddress').val();
    console.log(contractAddress);
    var secret = $('#exitRoad-secret').val();
    TollBoothOperator.at(contractAddress).then(function(instance) {
      tollBoothOperator = instance;
      return tollBoothOperator.reportExitRoad.call(secret, {from: tollboothAccount});
    }).then(function(e){
      if (e) {
        return tollBoothOperator.reportExitRoad(secret, {from: tollboothAccount, gas: 4712388});
      }
    }).then(function(tx){
      console.log(tx);
      $('#exitresponse').html('');
      for (var i=0; i < tx.logs.length; i++) {
        if (tx.logs[i].event === 'LogRoadExited') {
          //Alert! LogRoadExited event has no vehicle nor is there a method to get a vehicle by secret

          // var event = {
          //   booth: tx.logs[i].args.exitBooth,
          //   vehicle: tx.logs[i].args.vehicle,
          //   event: 'exit',
          // }
          // enterExit.push(event);
        }
        $('#exitresponse').append(tx.logs[i].event + ' ' + JSON.stringify(tx.logs[i].args) + '<br/>');
      }
    }).catch(function(e) {
      console.log(e);
      self.setStatus("Error exiting road; see log.");
    });
  },

  setStatus: function(message) {
    var status = document.getElementById("status");
    status.innerHTML = message;
  },

};

window.addEventListener('load', function() {
  // Checking if Web3 has been injected by the browser (Mist/MetaMask)
  if (typeof web3 !== 'undefined') {
    console.warn("Using web3 detected from external source. If you find that your accounts don't appear or you have 0 MetaCoin, ensure you've configured that source properly. If using MetaMask, see the following link. Feel free to delete this warning. :) http://truffleframework.com/tutorials/truffle-and-metamask")
    // Use Mist/MetaMask's provider
    window.web3 = new Web3(web3.currentProvider);
  } else {
    console.warn("No web3 detected. Falling back to http://127.0.0.1:8545. You should remove this fallback when you deploy live, as it's inherently insecure. Consider switching to Metamask for development. More info here: http://truffleframework.com/tutorials/truffle-and-metamask");
    // fallback - use your fallback strategy (local node / hosted node + in-dapp id mgmt / fail)
    window.web3 = new Web3(new Web3.providers.HttpProvider("http://127.0.0.1:8545"));
  }

  App.start();
});
