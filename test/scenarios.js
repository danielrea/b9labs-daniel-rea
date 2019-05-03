const expectedExceptionPromise = require("../utils/expectedException.js");
web3.eth.getTransactionReceiptMined = require("../utils/getTransactionReceiptMined.js");
Promise = require("bluebird");
Promise.allNamed = require("../utils/sequentialPromiseNamed.js");
const isAddress = require("../utils/isAddress.js");
const randomIntIn = require("../utils/randomIntIn.js");
const toBytes32 = require("../utils/toBytes32.js");


const allArtifacts = {
    Owned: artifacts.require("./Owned.sol"),
    Pausable: artifacts.require("./Pausable.sol"),
    Regulator: artifacts.require("./Regulator.sol"),
    DepositHolder: artifacts.require("./DepositHolder.sol"),
    MultiplierHolder: artifacts.require("./MultiplierHolder.sol"),
    RoutePriceHolder: artifacts.require("./RoutePriceHolderMock.sol"),
    TollBoothHolder: artifacts.require("./TollBoothHolder.sol"),
    TollBoothOperator: artifacts.require("./TollBoothOperator.sol")
}

if (typeof web3.eth.getAccountsPromise === "undefined") {
    Promise.promisifyAll(web3.eth, { suffix: "Promise" });
}

const Regulator = artifacts.require("./Regulator.sol");
const TollBoothOperator = artifacts.require("./TollBoothOperator.sol");

contract('Regulator, Toll Booth Operator', function(accounts) {

      let owner0, owner1,
          booth0, booth1, booth2,
          vehicle0, vehicle1,
          regulator, operator;
      const price01 = 10;
      const price02 = 15;
      const price03 = 6;
      const price04 = 11;
      const deposit0 = 10;
      const deposit1 = 14;
      const deposit2 = 11;
      const vehicleType0 = randomIntIn(1, 1000);
      const vehicleType1 = vehicleType0 + randomIntIn(1, 1000);
      const multiplier = 1;
      const tmpSecret = randomIntIn(1, 1000);
      const secret0 = toBytes32(tmpSecret);
      const secret1 = toBytes32(tmpSecret + randomIntIn(1001, 2000));
      const secret2 = toBytes32(tmpSecret + randomIntIn(2001, 3000));
      const secret3 = toBytes32(tmpSecret + randomIntIn(3001, 4000));
      const secret4 = toBytes32(tmpSecret + randomIntIn(4001, 5000));
      const secret5 = toBytes32(tmpSecret + randomIntIn(5001, 6000));
      let hashed0, hashed1, hashed2, hashed3, hashed4, hashed5;

      before("should prepare", function() {
          assert.isAtLeast(accounts.length, 8);
          owner0 = accounts[0];
          owner1 = accounts[1];
          booth0 = accounts[2];
          booth1 = accounts[3];
          booth2 = accounts[4];
          vehicle0 = accounts[5];
          vehicle1 = accounts[6];
          return web3.eth.getBalancePromise(owner0)
              .then(balance => assert.isAtLeast(web3.fromWei(balance).toNumber(), 10));
      });

      before("should deploy regulator and operator", function() {
          return Regulator.new({ from: owner0 })
              .then(instance => regulator = instance)
              .then(() => regulator.setVehicleType(vehicle0, vehicleType0, { from: owner0 }))
              .then(tx => regulator.setVehicleType(vehicle1, vehicleType1, { from: owner0 }))
              .then(tx => regulator.createNewOperator(owner1, deposit0, { from: owner0 }))
              .then(tx => operator = TollBoothOperator.at(tx.logs[1].args.newOperator))
              .then(() => operator.addTollBooth(booth0, { from: owner1 }))
              .then(tx => operator.addTollBooth(booth1, { from: owner1 }))
              .then(tx => operator.addTollBooth(booth2, { from: owner1 }))
              .then(tx => operator.setMultiplier(vehicleType0, multiplier, { from: owner1 }))
              .then(tx => operator.setRoutePrice(booth0, booth1, price01, { from: owner1 }))
              .then(tx => operator.setPaused(false, { from: owner1 }))
              .then(tx => operator.hashSecret(secret0))
              .then(hash => hashed0 = hash)
              .then(tx => operator.hashSecret(secret1))
              .then(hash => hashed1 = hash)
              .then(tx => operator.hashSecret(secret2))
              .then(hash => hashed2 = hash)
              .then(tx => operator.hashSecret(secret3))
              .then(hash => hashed3 = hash)
              .then(tx => operator.hashSecret(secret4))
              .then(hash => hashed4 = hash)
              .then(tx => operator.hashSecret(secret5))
              .then(hash => hashed5 = hash);
      });

    describe("Scenario 1", function() {
      it("Should enter vehicle at booth 1, exit at booth 2 and receive no refund", function() {
        return operator.enterRoad.call(
                booth0, hashed0, { from: vehicle0, value: (deposit0 * multiplier) })
            .then(success => assert.isTrue(success))
            .then(() => operator.enterRoad(
                booth0, hashed0, { from: vehicle0, value: (deposit0 * multiplier) }))
            .then(tx => {
                assert.strictEqual(tx.receipt.logs.length, 1);
                assert.strictEqual(tx.logs.length, 1);
                const logEntered = tx.logs[0];
                assert.strictEqual(logEntered.event, "LogRoadEntered");
                assert.strictEqual(logEntered.args.vehicle, vehicle0);
                assert.strictEqual(logEntered.args.entryBooth, booth0);
                assert.strictEqual(logEntered.args.exitSecretHashed, hashed0);
                assert.strictEqual(logEntered.args.depositedWeis.toNumber(), (deposit0 * multiplier));
                return operator.getVehicleEntry(hashed0);
            })
            .then(info => {
                assert.strictEqual(info[0], vehicle0);
                assert.strictEqual(info[1], booth0);
                assert.strictEqual(info[2].toNumber(), (deposit0 * multiplier));
                return operator.reportExitRoad( secret0, { from: booth1 });
            })
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logExited = tx.logs[0];
              assert.strictEqual(logExited.event, "LogRoadExited");
              assert.strictEqual(logExited.args.exitBooth, booth1);
              assert.strictEqual(logExited.args.exitSecretHashed, hashed0);
              assert.strictEqual(logExited.args.finalFee.toNumber(), 10);
              assert.strictEqual(logExited.args.refundWeis.toNumber(), 0);
            });
      });
    });

    describe("Scenario 2", function() {
      before("should change route price", function() {
        return operator.setRoutePrice(booth0, booth1, price02, { from: owner1 });
      });
      it("Should enter vehicle at booth 1, exit at booth 2 and receive no refund for excessive route price", function() {
        return operator.enterRoad.call(
                booth0, hashed1, { from: vehicle0, value: (deposit0 * multiplier) })
            .then(success => assert.isTrue(success))
            .then(() => operator.enterRoad(
                booth0, hashed1, { from: vehicle0, value: (deposit0 * multiplier) }))
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logEntered = tx.logs[0];
              assert.strictEqual(logEntered.event, "LogRoadEntered");
              assert.strictEqual(logEntered.args.vehicle, vehicle0);
              assert.strictEqual(logEntered.args.entryBooth, booth0);
              assert.strictEqual(logEntered.args.exitSecretHashed, hashed1);
              assert.strictEqual(logEntered.args.depositedWeis.toNumber(), (deposit0 * multiplier));
              return operator.getVehicleEntry(hashed1);
            })
            .then(info => {
                assert.strictEqual(info[0], vehicle0);
                assert.strictEqual(info[1], booth0);
                assert.strictEqual(info[2].toNumber(), (deposit0 * multiplier));
                return operator.reportExitRoad( secret1, { from: booth1 });
            })
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logExited = tx.logs[0];
              assert.strictEqual(logExited.event, "LogRoadExited");
              assert.strictEqual(logExited.args.exitBooth, booth1);
              assert.strictEqual(logExited.args.exitSecretHashed, hashed1);
              assert.strictEqual(logExited.args.finalFee.toNumber(), 10);
              assert.strictEqual(logExited.args.refundWeis.toNumber(), 0);

            });
      });
    });

    describe("Scenario 3", function() {
      before("should change route price", function() {
        return operator.setRoutePrice(booth0, booth1, price03, { from: owner1 });
      });
      it("Should enter vehicle at booth 1, exit at booth 2 and receive refund for excessive deposit", function() {
        return operator.enterRoad.call(
                booth0, hashed2, { from: vehicle0, value: (deposit0 * multiplier) })
            .then(success => assert.isTrue(success))
            .then(() => operator.enterRoad(
                booth0, hashed2, { from: vehicle0, value: (deposit0 * multiplier) }))
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logEntered = tx.logs[0];
              assert.strictEqual(logEntered.event, "LogRoadEntered");
              assert.strictEqual(logEntered.args.vehicle, vehicle0);
              assert.strictEqual(logEntered.args.entryBooth, booth0);
              assert.strictEqual(logEntered.args.exitSecretHashed, hashed2);
              assert.strictEqual(logEntered.args.depositedWeis.toNumber(), (deposit0 * multiplier));
              return operator.getVehicleEntry(hashed2);
            })
            .then(info => {
                assert.strictEqual(info[0], vehicle0);
                assert.strictEqual(info[1], booth0);
                assert.strictEqual(info[2].toNumber(), (deposit0 * multiplier));
                return operator.reportExitRoad( secret2, { from: booth1 });
            })
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logExited = tx.logs[0];
              assert.strictEqual(logExited.event, "LogRoadExited");
              assert.strictEqual(logExited.args.exitBooth, booth1);
              assert.strictEqual(logExited.args.exitSecretHashed, hashed2);
              assert.strictEqual(logExited.args.finalFee.toNumber(), 6);
              assert.strictEqual(logExited.args.refundWeis.toNumber(), 4);
            });
      });
    });

    describe("Scenario 4", function() {
      before("should change route price", function() {
        return operator.setRoutePrice(booth0, booth1, price01, { from: owner1 });
      });
      it("Should enter vehicle at booth 1, exit at booth 2 receive refund for excessive deposit", function() {
        return operator.enterRoad.call(
                booth0, hashed3, { from: vehicle0, value: (deposit1 * multiplier) })
            .then(success => assert.isTrue(success))
            .then(() => operator.enterRoad(
                booth0, hashed3, { from: vehicle0, value: (deposit1 * multiplier) }))
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logEntered = tx.logs[0];
              assert.strictEqual(logEntered.event, "LogRoadEntered");
              assert.strictEqual(logEntered.args.vehicle, vehicle0);
              assert.strictEqual(logEntered.args.entryBooth, booth0);
              assert.strictEqual(logEntered.args.exitSecretHashed, hashed3);
              assert.strictEqual(logEntered.args.depositedWeis.toNumber(), (deposit1 * multiplier));
              return operator.getVehicleEntry(hashed3);
            })
            .then(info => {
                assert.strictEqual(info[0], vehicle0);
                assert.strictEqual(info[1], booth0);
                assert.strictEqual(info[2].toNumber(), (deposit1 * multiplier));
                return operator.reportExitRoad( secret3, { from: booth1 });
            })
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logExited = tx.logs[0];
              assert.strictEqual(logExited.event, "LogRoadExited");
              assert.strictEqual(logExited.args.exitBooth, booth1);
              assert.strictEqual(logExited.args.exitSecretHashed, hashed3);
              assert.strictEqual(logExited.args.finalFee.toNumber(), 10);
              assert.strictEqual(logExited.args.refundWeis.toNumber(), 4);

            });
      });
    });

    describe("Scenario 5", function() {
      before("should deploy new regulator and operator", function() {
        return Regulator.new({ from: owner0 })
            .then(instance => regulator = instance)
            .then(() => regulator.setVehicleType(vehicle0, vehicleType0, { from: owner0 }))
            .then(tx => regulator.setVehicleType(vehicle1, vehicleType1, { from: owner0 }))
            .then(tx => regulator.createNewOperator(owner1, deposit0, { from: owner0 }))
            .then(tx => operator = TollBoothOperator.at(tx.logs[1].args.newOperator))
            .then(() => operator.addTollBooth(booth0, { from: owner1 }))
            .then(tx => operator.addTollBooth(booth1, { from: owner1 }))
            .then(tx => operator.addTollBooth(booth2, { from: owner1 }))
            .then(tx => operator.setMultiplier(vehicleType0, multiplier, { from: owner1 }))
            .then(tx => operator.setPaused(false, { from: owner1 }))
            .then(tx => operator.hashSecret(secret0))
            .then(hash => hashed0 = hash)
            .then(tx => operator.hashSecret(secret1))
            .then(hash => hashed1 = hash)
            .then(tx => operator.hashSecret(secret2))
            .then(hash => hashed2 = hash)
            .then(tx => operator.hashSecret(secret3))
            .then(hash => hashed3 = hash)
            .then(tx => operator.hashSecret(secret4))
            .then(hash => hashed4 = hash)
            .then(tx => operator.hashSecret(secret5))
            .then(hash => hashed5 = hash);
      });

      it("Should enter vehicle at booth 1, exit at booth 2, update route price and receive refund", function() {
        return operator.enterRoad.call(
                booth0, hashed4, { from: vehicle0, value: (deposit1 * multiplier) })
            .then(success => assert.isTrue(success))
            .then(() => operator.enterRoad(
                booth0, hashed4, { from: vehicle0, value: (deposit1 * multiplier) }))
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logEntered = tx.logs[0];
              assert.strictEqual(logEntered.event, "LogRoadEntered");
              assert.strictEqual(logEntered.args.vehicle, vehicle0);
              assert.strictEqual(logEntered.args.entryBooth, booth0);
              assert.strictEqual(logEntered.args.exitSecretHashed, hashed4);
              assert.strictEqual(logEntered.args.depositedWeis.toNumber(), (deposit1 * multiplier));
              return operator.getVehicleEntry(hashed4);
            })
            .then(info => {
                assert.strictEqual(info[0], vehicle0);
                assert.strictEqual(info[1], booth0);
                assert.strictEqual(info[2].toNumber(), (deposit1 * multiplier));
                return operator.reportExitRoad( secret4, { from: booth1 });
            })
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 1);
              assert.strictEqual(tx.logs.length, 1);
              const logPending = tx.logs[0];
              assert.strictEqual(logPending.event, "LogPendingPayment");
              assert.strictEqual(logPending.args.exitSecretHashed, hashed4);
              assert.strictEqual(logPending.args.entryBooth, booth0);
              assert.strictEqual(logPending.args.exitBooth, booth1);
              return operator.setRoutePrice(booth0, booth1, price04, { from: owner1 });
            })
            .then(tx => {
              assert.strictEqual(tx.receipt.logs.length, 2);
              assert.strictEqual(tx.logs.length, 2);
              const logPriceSet = tx.logs[0];
              assert.strictEqual(logPriceSet.event, "LogRoutePriceSet");
              assert.strictEqual(logPriceSet.args.sender, owner1);
              assert.strictEqual(logPriceSet.args.entryBooth, booth0);
              assert.strictEqual(logPriceSet.args.exitBooth, booth1);
              assert.strictEqual(logPriceSet.args.priceWeis.toNumber(), price04);
              const logExited = tx.logs[1];
              assert.strictEqual(logExited.event, "LogRoadExited");
              assert.strictEqual(logExited.args.exitBooth, booth1);
              assert.strictEqual(logExited.args.exitSecretHashed, hashed4);
              assert.strictEqual(logExited.args.finalFee.toNumber(), 11);
              assert.strictEqual(logExited.args.refundWeis.toNumber(), 3);
            });
      });
    });


        describe("Scenario 6", function() {
          before("should deploy new regulator and operator", function() {
            return Regulator.new({ from: owner0 })
                .then(instance => regulator = instance)
                .then(() => regulator.setVehicleType(vehicle0, vehicleType0, { from: owner0 }))
                .then(tx => regulator.setVehicleType(vehicle1, vehicleType1, { from: owner0 }))
                .then(tx => regulator.createNewOperator(owner1, deposit0, { from: owner0 }))
                .then(tx => operator = TollBoothOperator.at(tx.logs[1].args.newOperator))
                .then(() => operator.addTollBooth(booth0, { from: owner1 }))
                .then(tx => operator.addTollBooth(booth1, { from: owner1 }))
                .then(tx => operator.addTollBooth(booth2, { from: owner1 }))
                .then(tx => operator.setMultiplier(vehicleType0, multiplier, { from: owner1 }))
                .then(tx => operator.setMultiplier(vehicleType1, multiplier, { from: owner1 }))
                .then(tx => operator.setPaused(false, { from: owner1 }))
                .then(tx => operator.hashSecret(secret0))
                .then(hash => hashed0 = hash)
                .then(tx => operator.hashSecret(secret1))
                .then(hash => hashed1 = hash)
                .then(tx => operator.hashSecret(secret2))
                .then(hash => hashed2 = hash)
                .then(tx => operator.hashSecret(secret3))
                .then(hash => hashed3 = hash)
                .then(tx => operator.hashSecret(secret4))
                .then(hash => hashed4 = hash)
                .then(tx => operator.hashSecret(secret5))
                .then(hash => hashed5 = hash);
          });

          it("Should enter vehicle at booth 1, exit at booth 2, update route price and receive refund", function() {
            return operator.enterRoad.call(
                    booth0, hashed4, { from: vehicle0, value: (deposit1 * multiplier) })
                .then(success => assert.isTrue(success))
                .then(() => operator.enterRoad(
                    booth0, hashed4, { from: vehicle0, value: (deposit1 * multiplier) }))
                .then(tx => {
                  assert.strictEqual(tx.receipt.logs.length, 1);
                  assert.strictEqual(tx.logs.length, 1);
                  const logEntered = tx.logs[0];
                  assert.strictEqual(logEntered.event, "LogRoadEntered");
                  assert.strictEqual(logEntered.args.vehicle, vehicle0);
                  assert.strictEqual(logEntered.args.entryBooth, booth0);
                  assert.strictEqual(logEntered.args.exitSecretHashed, hashed4);
                  assert.strictEqual(logEntered.args.depositedWeis.toNumber(), (deposit1 * multiplier));
                  return operator.getVehicleEntry(hashed4);
                })
                .then(info => {
                    assert.strictEqual(info[0], vehicle0);
                    assert.strictEqual(info[1], booth0);
                    assert.strictEqual(info[2].toNumber(), (deposit1 * multiplier));
                    return operator.reportExitRoad( secret4, { from: booth1 });
                })
                .then(tx => {
                  assert.strictEqual(tx.receipt.logs.length, 1);
                  assert.strictEqual(tx.logs.length, 1);
                  const logPending = tx.logs[0];
                  assert.strictEqual(logPending.event, "LogPendingPayment");
                  assert.strictEqual(logPending.args.exitSecretHashed, hashed4);
                  assert.strictEqual(logPending.args.entryBooth, booth0);
                  assert.strictEqual(logPending.args.exitBooth, booth1);
                  return operator.enterRoad.call(
                          booth0, hashed5, { from: vehicle1, value: (deposit0 * multiplier) })

                })
                .then(success => assert.isTrue(success))
                .then(() => operator.enterRoad(
                    booth0, hashed5, { from: vehicle1, value: (deposit0 * multiplier) }))
                .then(tx => {
                  assert.strictEqual(tx.receipt.logs.length, 1);
                  assert.strictEqual(tx.logs.length, 1);
                  const logEntered = tx.logs[0];
                  assert.strictEqual(logEntered.event, "LogRoadEntered");
                  assert.strictEqual(logEntered.args.vehicle, vehicle1);
                  assert.strictEqual(logEntered.args.entryBooth, booth0);
                  assert.strictEqual(logEntered.args.exitSecretHashed, hashed5);
                  assert.strictEqual(logEntered.args.depositedWeis.toNumber(), (deposit0 * multiplier));
                  return operator.getVehicleEntry(hashed5);
                })
                .then(info => {
                    assert.strictEqual(info[0], vehicle1);
                    assert.strictEqual(info[1], booth0);
                    assert.strictEqual(info[2].toNumber(), (deposit0 * multiplier));
                    return operator.reportExitRoad( secret5, { from: booth1 });
                })
                .then(tx => {
                  assert.strictEqual(tx.receipt.logs.length, 1);
                  assert.strictEqual(tx.logs.length, 1);
                  const logPending = tx.logs[0];
                  assert.strictEqual(logPending.event, "LogPendingPayment");
                  assert.strictEqual(logPending.args.exitSecretHashed, hashed5);
                  assert.strictEqual(logPending.args.entryBooth, booth0);
                  assert.strictEqual(logPending.args.exitBooth, booth1);
                  return operator.setRoutePrice(booth0, booth1, price03, { from: owner1 });
                })
                .then(tx => {
                  assert.strictEqual(tx.receipt.logs.length, 2);
                  assert.strictEqual(tx.logs.length, 2);
                  const logPriceSet = tx.logs[0];
                  assert.strictEqual(logPriceSet.event, "LogRoutePriceSet");
                  assert.strictEqual(logPriceSet.args.sender, owner1);
                  assert.strictEqual(logPriceSet.args.entryBooth, booth0);
                  assert.strictEqual(logPriceSet.args.exitBooth, booth1);
                  assert.strictEqual(logPriceSet.args.priceWeis.toNumber(), price03);
                  const logExited = tx.logs[1];
                  assert.strictEqual(logExited.event, "LogRoadExited");
                  assert.strictEqual(logExited.args.exitBooth, booth1);
                  assert.strictEqual(logExited.args.exitSecretHashed, hashed4);
                  assert.strictEqual(logExited.args.finalFee.toNumber(), 6);
                  assert.strictEqual(logExited.args.refundWeis.toNumber(), 8);
                  return operator.clearSomePendingPayments(booth0, booth1, 1, { from: owner1 });
                })
                .then(tx => {
                  assert.strictEqual(tx.receipt.logs.length, 1);
                  assert.strictEqual(tx.logs.length, 1);
                  const logExited = tx.logs[0];
                  assert.strictEqual(logExited.event, "LogRoadExited");
                  assert.strictEqual(logExited.args.exitBooth, booth1);
                  assert.strictEqual(logExited.args.exitSecretHashed, hashed5);
                  assert.strictEqual(logExited.args.finalFee.toNumber(), 6);
                  assert.strictEqual(logExited.args.refundWeis.toNumber(), 4);
                })
          });
        });

});
