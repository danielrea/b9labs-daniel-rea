var Regulator = artifacts.require("./Regulator.sol");
var TollBoothOperator = artifacts.require("./TollBoothOperator.sol");
var regulatorAddress;
var tollBoothOperator;
var tollBoothOperatorOwner = web3.eth.accounts[1];
var tollBoothRegulator = web3.eth.accounts[5];

module.exports = function(deployer) {
  deployer.deploy(TollBoothOperator, true, 1, tollBoothRegulator);
  deployer.deploy(Regulator).then(function() {
    return Regulator.new();
  }).then(function(instance) {
    var regulator = instance;
    return regulator.createNewOperator(tollBoothOperatorOwner, 1);
  }).then(function(tx) {
    newOperatorAddress = tx.logs[1].args.newOperator
    return TollBoothOperator.at(tx.logs[1].args.newOperator);
  }).then(function(tollBooth){
    tollBoothOperator = tollBooth;
    return tollBoothOperator.setPaused(false, { from: tollBoothOperatorOwner });
  }).then(function(tx) {
    return tollBoothOperator.isPaused();
  }).then(function(isPaused){
  });

};
