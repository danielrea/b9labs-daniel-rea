pragma solidity ^0.4.13;
import "./Owned.sol";
import "./interfaces/DepositHolderI.sol";

contract DepositHolder is Owned, DepositHolderI {
  uint private depositWeiAmount;

  function DepositHolder(uint initialWeis) {
    require(initialWeis > 0);
    depositWeiAmount = initialWeis;
  }

    /*
     * Event emitted when the deposit value has been set.
     * @param sender The account that ran the action.
     * @param depositWeis The value of the deposit measured in weis.
     */
    event LogDepositSet(address indexed sender, uint depositWeis);

    /*
     * Called by the owner of the DepositHolder.
     *     It should roll back if the caller is not the owner of the contract. x
     *     It should roll back if the argument passed is 0. x
     *     It should roll back if the argument is no different from the current deposit. x
     * @param depositWeis The value of the deposit being set, measure in weis.
     * @return Whether the action was successful.
     * Emits LogDepositSet.
     */
    function setDeposit(uint depositWeis)
        public
        fromOwner()
        returns(bool success) {
          require(depositWeis > 0);
          require(depositWeis != depositWeiAmount);
          depositWeiAmount = depositWeis;
          LogDepositSet(msg.sender, depositWeiAmount);
          return true;
        }

    /*
     * @return The base price, then to be multiplied by the multiplier, a given vehicle
     * needs to deposit to enter the road system.
     */
    function getDeposit()
        constant
        public
        returns(uint weis) {
          return depositWeiAmount;
        }

    /*
     * You need to create:
     *
     * - a contract named `DepositHolder` that:
     *     - is `OwnedI`, and `DepositHolderI`.
     *     - has a constructor that takes:
     *         - one `uint` parameter, the initial deposit wei value, which cannot be 0.
     */
}
