pragma solidity ^0.4.13;
import "./Owned.sol";
import "./Pausable.sol";
import "./Regulated.sol";
import "./MultiplierHolder.sol";
import "./DepositHolder.sol";
import "./TollBoothHolder.sol";
import "./RoutePriceHolder.sol";
import "./interfaces/TollBoothOperatorI.sol";

  contract TollBoothOperator is TollBoothOperatorI, Owned, Pausable, Regulated, MultiplierHolder, DepositHolder, TollBoothHolder, RoutePriceHolder {

    uint collectedFees;

    struct VehicleTrip {
      address vehicleAddress;
      bytes32 exitSecretHashed;
      bool paid;
      bool exited;
      uint fee;
      uint feeRefund;
      uint routePrice;
      uint vehicleType;
      address entryBooth;
      address exitBooth;
      uint multiplier;
      uint vehicleDepositWei;
    }

    mapping(bytes32 => VehicleTrip) vehicleTrips;

    struct PendingPayment
    {
        address vehicleAddress;
        bool pendingPayment;
        bytes32 entryexitHash;
        bytes32 exitSecretHashed;
        address entryBooth;
        address exitBooth;
    }
    PendingPayment[] pendingPayments;

    /*address public owner;*/

    function TollBoothOperator(bool _paused, uint _depositWei, address _regulator) Pausable(_paused) DepositHolder(_depositWei) Regulated(_regulator) {
      require(_depositWei > 0);
      require(_regulator != address(0));

      /*owner = _regulator;*/
    }
    /*
     * This provides a single source of truth for the encoding algorithm.
     * @param secret The secret to be hashed.
     * @return the hashed secret.
     */
    function hashSecret(bytes32 secret)
        constant
        public
        returns(bytes32 hashed) {
          return keccak256(secret);
        }

    /*
     * Event emitted when a vehicle made the appropriate deposit to enter the road system.
     * @param vehicle The address of the vehicle that entered the road system.
     * @param entryBooth The declared entry booth by which the vehicle will enter the system.
     * @param exitSecretHashed A hashed secret that when solved allows the operator to pay itself.
     * @param depositedWeis The amount that was deposited as part of the entry.
     */
    event LogRoadEntered(
        address indexed vehicle,
        address indexed entryBooth,
        bytes32 indexed exitSecretHashed,
        uint depositedWeis);

    /*
     * Called by the vehicle entering a road system.
     * Off-chain, the entry toll booth will open its gate up successful deposit and confirmation
     * of the vehicle identity.
     *     It should roll back when the contract is in the `true` paused state. x
     *     It should roll back when the vehicle is not a registered vehicle.  x
     *     It should roll back when the vehicle is not allowed on this road system
     *     It should roll back if `entryBooth` is not a tollBooth. x
     *     It should roll back if less than deposit * multiplier was sent alongside. x
     *     It should roll back if `exitSecretHashed` has previously been used to enter. x
     *     It should be possible for a vehicle to enter "again" before it has exited from the
     *       previous entry. x
     * @param entryBooth The declared entry booth by which the vehicle will enter the system.
     * @param exitSecretHashed A hashed secret that when solved allows the operator to pay itself.
     * @return Whether the action was successful.
     * Emits LogRoadEntered.
     */
    function enterRoad(
            address entryBooth,
            bytes32 exitSecretHashed)
        public
        whenNotPaused()
        payable
        returns (bool success) {
          require(getRegulator().getVehicleType(msg.sender) != 0);
          require(isTollBooth(entryBooth));
          uint vehicleType = getRegulator().getVehicleType(msg.sender);
          uint multiplier = getMultiplier(vehicleType);
          require(multiplier > 0);
          uint cost = getDeposit() * multiplier;
          assert(getDeposit() == 0 || cost / getDeposit() == multiplier);
          require(msg.value >= cost);
          require(vehicleTrips[exitSecretHashed].exitSecretHashed != exitSecretHashed);
          vehicleTrips[exitSecretHashed].vehicleAddress = msg.sender;
          vehicleTrips[exitSecretHashed].exitSecretHashed = exitSecretHashed;
          vehicleTrips[exitSecretHashed].exited = false;
          vehicleTrips[exitSecretHashed].entryBooth = entryBooth;
          vehicleTrips[exitSecretHashed].vehicleType = vehicleType;
          vehicleTrips[exitSecretHashed].multiplier = multiplier;
          vehicleTrips[exitSecretHashed].vehicleDepositWei = msg.value;
          LogRoadEntered(
            msg.sender,
            entryBooth,
            exitSecretHashed,
            msg.value);
          return true;
        }

    /*
     * @param exitSecretHashed The hashed secret used by the vehicle when entering the road.
     * @return The information pertaining to the entry of the vehicle.
     *     vehicle: the address of the vehicle that entered the system.
     *     entryBooth: the address of the booth the vehicle entered at.
     *     depositedWeis: how much the vehicle deposited when entering.
     * After the vehicle has exited, `depositedWeis` should be returned as `0`.
     * If no vehicles had ever entered with this hash, all values should be returned as `0`.
     */
    function getVehicleEntry(bytes32 exitSecretHashed)
        constant
        public
        returns(
            address vehicle,
            address entryBooth,
            uint depositedWeis) {
              if(vehicleTrips[exitSecretHashed].exited)
              {
                  vehicleTrips[exitSecretHashed].vehicleDepositWei = 0;
              }

              if(vehicleTrips[exitSecretHashed].vehicleAddress == address(0))
              {
                return(address(0),address(0),0);
              }
              return(vehicleTrips[exitSecretHashed].vehicleAddress,
                vehicleTrips[exitSecretHashed].entryBooth,
                vehicleTrips[exitSecretHashed].vehicleDepositWei);
            }

    /*
     * Event emitted when a vehicle exits a road system.
     * @param exitBooth The toll booth that saw the vehicle exit.
     * @param exitSecretHashed The hash of the secret given by the vehicle as it
     *     passed by the exit booth.
     * @param finalFee The toll fee taken from the deposit.
     * @param refundWeis The amount refunded to the vehicle, i.e. deposit - fee.
     */
    event LogRoadExited(
        address indexed exitBooth,
        bytes32 indexed exitSecretHashed,
        uint finalFee,
        uint refundWeis);

    /*
     * Event emitted when a vehicle used a route that has no known fee.
     * It is a signal for the oracle to provide a price for the pair.
     * @param exitSecretHashed The hashed secret that was defined at the time of entry.
     * @param entryBooth The address of the booth the vehicle entered at.
     * @param exitBooth The address of the booth the vehicle exited at.
     */
    event LogPendingPayment(
        bytes32 indexed exitSecretHashed,
        address indexed entryBooth,
        address indexed exitBooth);

    /*
     * Called by the exit booth.
     *     It should roll back when the contract is in the `true` paused state. x
     *     It should roll back when the sender is not a toll booth. x
     *     It should roll back when the vehicle is no longer a registered vehicle. x
     *     It should roll back when the vehicle is no longer allowed on this road system. ?
     *     It should roll back if the exit is same as the entry. x
     *     It should roll back if the secret does not match a hashed one. x
     *     It should roll back if the secret has already been reported on exit. x
     * @param exitSecretClear The secret given by the vehicle as it passed by the exit booth.
     * @return status:
     *   1: success, -> emits LogRoadExited
     *   2: pending oracle -> emits LogPendingPayment
     */
    function reportExitRoad(bytes32 exitSecretClear) public
        whenNotPaused()
        returns(uint status) {
          uint exitStatus = 1;
          require(isTollBooth(msg.sender));
          bytes32 exitSecretHashed = hashSecret(exitSecretClear);
          require(getRegulator().getVehicleType(vehicleTrips[exitSecretHashed].vehicleAddress) != 0);
          require(msg.sender != vehicleTrips[exitSecretHashed].entryBooth);
          require(vehicleTrips[exitSecretHashed].exitSecretHashed == exitSecretHashed);
          require(!vehicleTrips[exitSecretHashed].exited);
          uint routePrice = getRoutePrice(vehicleTrips[exitSecretHashed].entryBooth, msg.sender);
          uint fee = routePrice * vehicleTrips[exitSecretHashed].multiplier;
          assert(routePrice == 0 || fee / routePrice == vehicleTrips[exitSecretHashed].multiplier);
          if (fee > vehicleTrips[exitSecretHashed].vehicleDepositWei ) {
            fee = vehicleTrips[exitSecretHashed].vehicleDepositWei;
          }
          uint remainder = vehicleTrips[exitSecretHashed].vehicleDepositWei - fee;

          if(fee > vehicleTrips[exitSecretHashed].vehicleDepositWei) {
            remainder = 0;
          }

          collectedFees += fee;

          vehicleTrips[exitSecretHashed].fee = fee;
          vehicleTrips[exitSecretHashed].feeRefund = remainder;
          vehicleTrips[exitSecretHashed].routePrice = routePrice;
          vehicleTrips[exitSecretHashed].exitBooth = msg.sender;

          if (routePrice == 0) {
            exitStatus = 2;
            vehicleTrips[exitSecretHashed].exited = false;
            PendingPayment memory pendingPayment;
            pendingPayment.vehicleAddress = vehicleTrips[exitSecretHashed].vehicleAddress;
            pendingPayment.pendingPayment = true;
            pendingPayment.exitSecretHashed = exitSecretHashed;
            pendingPayment.entryBooth = vehicleTrips[exitSecretHashed].entryBooth;
            pendingPayment.exitBooth = msg.sender;
            pendingPayment.entryexitHash = keccak256(vehicleTrips[exitSecretHashed].entryBooth, msg.sender);
            pendingPayments.push(pendingPayment);
            LogPendingPayment(
              exitSecretHashed,
              vehicleTrips[exitSecretHashed].entryBooth,
              vehicleTrips[exitSecretHashed].exitBooth);
          }
          else {
            vehicleTrips[exitSecretHashed].exited = true;
            vehicleTrips[exitSecretHashed].paid = true;
            if (remainder > 0) {
              require(vehicleTrips[exitSecretHashed].vehicleAddress.send(remainder));
            }
            LogRoadExited(vehicleTrips[exitSecretHashed].exitBooth,
            vehicleTrips[exitSecretHashed].exitSecretHashed,
            fee,
            remainder);
          }
          return exitStatus;
        }

    /*
     * @param entryBooth the entry booth that has pending payments.
     * @param exitBooth the exit booth that has pending payments.
     * @return the number of payments that are pending because the price for the
     * entry-exit pair was unknown.
     */
    function getPendingPaymentCount(address entryBooth, address exitBooth)
        constant
        public
        returns (uint count) {
          bytes32 keccakhash = keccak256(entryBooth, exitBooth);
          uint totalPaymentsPending = 0;

          for(uint i = 0; i < pendingPayments.length; i++) {
            if (pendingPayments[i].entryexitHash == keccakhash) {
              if (pendingPayments[i].pendingPayment) {
                totalPaymentsPending++;
              }
            }
          }
          return totalPaymentsPending;
        }

    /*
     * Can be called by anyone. In case more than 1 payment was pending when the oracle gave a price.
     *     It should roll back when the contract is in `true` paused state. x
     *     It should roll back if booths are not really booths. x
     *     It should roll back if there are fewer than `count` pending payment that are solvable. x
     *     It should roll back if `count` is `0`. x
     * @param entryBooth the entry booth that has pending payments.
     * @param exitBooth the exit booth that has pending payments.
     * @param count the number of pending payments to clear for the exit booth.
     * @return Whether the action was successful.
     * Emits LogRoadExited as many times as count.
     */
    function clearSomePendingPayments(
            address entryBooth,
            address exitBooth,
            uint count)
        public
        whenNotPaused()
        returns (bool success) {
          require(isTollBooth(entryBooth));
          require(isTollBooth(exitBooth));
          require(count > 0);
          bytes32 keccakhash = keccak256(entryBooth, exitBooth);
          uint totalPaymentsPending;
          for (uint i=0; i < pendingPayments.length; i++) {
            if(pendingPayments[i].entryexitHash == keccakhash && pendingPayments[i].pendingPayment)
            {
               totalPaymentsPending++;
               if (count >= totalPaymentsPending) {
                 pendingPayments[i].pendingPayment = false;
                 uint fee = routes[keccakhash].priceWeis * vehicleTrips[pendingPayments[i].exitSecretHashed].multiplier;
                 assert(routes[keccakhash].priceWeis == 0 || fee / routes[keccakhash].priceWeis == vehicleTrips[pendingPayments[i].exitSecretHashed].multiplier);
                 if (fee > vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleDepositWei ) {
                   fee = vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleDepositWei;
                 }
                 uint remainder = vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleDepositWei - fee;

                 if(fee > vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleDepositWei) {
                   remainder = 0;
                 }

                 vehicleTrips[pendingPayments[i].exitSecretHashed].fee = fee;
                 vehicleTrips[pendingPayments[i].exitSecretHashed].feeRefund = remainder;
                 vehicleTrips[pendingPayments[i].exitSecretHashed].paid = true;
                 vehicleTrips[pendingPayments[i].exitSecretHashed].exited = true;
                 vehicleTrips[pendingPayments[i].exitSecretHashed].routePrice = routes[keccakhash].priceWeis;
                 collectedFees += fee;
                 if (remainder > 0) {
                   require(vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleAddress.send(remainder));
                 }
                LogRoadExited(exitBooth,
                  pendingPayments[i].exitSecretHashed,
                  vehicleTrips[pendingPayments[i].exitSecretHashed].fee,
                  vehicleTrips[pendingPayments[i].exitSecretHashed].feeRefund);
               }
            }
          }
          require(count <= totalPaymentsPending);
          return true;

        }

    /*
     * @return The amount that has been collected through successful payments. This is the current
     *   amount, it does not reflect historical fees. So this value goes back to zero after a call
     *   to `withdrawCollectedFees`.
     */
    function getCollectedFeesAmount()
        constant
        public
        returns(uint amount) {
          return collectedFees;
        }

    /*
     * Event emitted when the owner collects the fees.
     * @param owner The account that sent the request.
     * @param amount The amount collected.
     */
    event LogFeesCollected(
        address indexed owner,
        uint amount);

    /*
     * Called by the owner of the contract to withdraw all collected fees (not deposits) to date.
     *     It should roll back if any other address is calling this function. x
     *     It should roll back if there is no fee to collect. x
     *     It should roll back if the transfer failed. x
     * @return success Whether the operation was successful.
     * Emits LogFeesCollected.
     */
    function withdrawCollectedFees()
        public
        fromOwner()
        returns(bool success) {
          require(collectedFees > 0);
          uint collectedFeesTemp = collectedFees;
          collectedFees = 0;
          require(msg.sender.send(collectedFeesTemp));
          LogFeesCollected(msg.sender, collectedFeesTemp);
          return true;
        }
    /*
     * This function overrides the eponymous function of `RoutePriceHolderI`, to which it adds the following
     * functionality:
     *     - If relevant, it will release 1 pending payment for this route. As part of this payment x
     *       release, it will emit the appropriate `LogRoadExited` event. x
     *     - In the case where the next relevant pending payment is not solvable, which can happen if,
     *       for instance the vehicle has had wrongly set values in the interim: x
     *       - It should release 0 pending payment x
     *       - It should not roll back the transaction x
     *       - It should behave as if there had been no pending payment, apart from the higher gas consumed. x
     *     - It should be possible to call it even when the contract is in the `true` paused state.
     * Emits LogRoadExited if applicable.
    function setRoutePrice(
            address entryBooth,
            address exitBooth,
            uint priceWeis)
        public
        returns(bool success);
     */
     function setRoutePrice(
             address entryBooth,
             address exitBooth,
             uint priceWeis)
         public
         fromOwner()
         returns(bool success) {
           require(entryBooth != exitBooth);
           require(entryBooth != address(0));
           require(exitBooth != address(0));
           require(isTollBooth(entryBooth));
           require(isTollBooth(exitBooth));
           bytes32 keccakhash = keccak256(entryBooth,exitBooth);
           require(routes[keccakhash].priceWeis != priceWeis);
           routes[keccakhash].priceWeis = priceWeis;
           routes[keccakhash].entryBooth = entryBooth;
           routes[keccakhash].exitBooth = exitBooth;
           LogRoutePriceSet(msg.sender, entryBooth, exitBooth, priceWeis);
           //release 1 pending payment
           for(uint i = 0; i < pendingPayments.length; i++) {
             if (pendingPayments[i].entryexitHash == keccakhash && pendingPayments[i].pendingPayment) {
               pendingPayments[i].pendingPayment = false;
               uint fee = routes[keccakhash].priceWeis * vehicleTrips[pendingPayments[i].exitSecretHashed].multiplier;
               assert(routes[keccakhash].priceWeis == 0 || fee / routes[keccakhash].priceWeis == vehicleTrips[pendingPayments[i].exitSecretHashed].multiplier);
               if (fee > vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleDepositWei ) {
                 fee = vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleDepositWei;
               }
                   uint remainder = vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleDepositWei - fee;

                   if(fee > vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleDepositWei) {
                     remainder = 0;
                   }
                   vehicleTrips[pendingPayments[i].exitSecretHashed].fee = fee;
                   vehicleTrips[pendingPayments[i].exitSecretHashed].feeRefund = remainder;
                   vehicleTrips[pendingPayments[i].exitSecretHashed].paid = true;
                   vehicleTrips[pendingPayments[i].exitSecretHashed].exited = true;
                   vehicleTrips[pendingPayments[i].exitSecretHashed].routePrice = routes[keccakhash].priceWeis;
                   collectedFees += fee;
                   if (remainder > 0) {
                     require(vehicleTrips[pendingPayments[i].exitSecretHashed].vehicleAddress.send(remainder));
                   }
                }

               LogRoadExited(exitBooth,
                 pendingPayments[i].exitSecretHashed,
                 vehicleTrips[pendingPayments[i].exitSecretHashed].fee,
                 vehicleTrips[pendingPayments[i].exitSecretHashed].feeRefund);
                return true;
             }
             return true;
           }

     function () {
         revert();
     }
    /*
     * You need to create:
     *
     * - a contract named `TollBoothOperator` that:
     *     - is `OwnedI`, `PausableI`, `DepositHolderI`, `TollBoothHolderI`,
     *         `MultiplierHolderI`, `RoutePriceHolderI`, `RegulatedI` and `TollBoothOperatorI`.
     *     - has a constructor that takes:
     *         - one `bool` parameter, the initial paused state.
     *         - one `uint` parameter, the initial deposit wei value, which cannot be 0.
     *         - one `address` parameter, the initial regulator, which cannot be 0.
     */
}
