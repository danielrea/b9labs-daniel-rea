pragma solidity ^0.4.13;
import "./Owned.sol";
import "./interfaces/TollBoothHolderI.sol";

contract TollBoothHolder is Owned, TollBoothHolderI {
  struct TollBooth {
    address addresslocation;
  }
  mapping(address => TollBooth) tollBooths;

  function TollBoothHolder() {
  }
    /* TollBoothHolder */
    /*
     * Event emitted when a toll booth has been added to the TollBoothOperator.
     * @param sender The account that ran the action.
     * @param tollBooth The toll booth just added.
     */
    event LogTollBoothAdded(
        address indexed sender,
        address indexed tollBooth);

    /*
     * Called by the owner of the TollBoothOperator.
     *     It should roll back if the caller is not the owner of the contract. x
     *     It should roll back if the argument is already a toll booth. x
     *     It should roll back if the argument is a 0x address. x
     *     When part of TollBoothOperatorI, it should be possible to add toll booths even when
     *       the contract is paused.
     * @param tollBooth The address of the toll booth being added.
     * @return Whether the action was successful.
     * Emits LogTollBoothAdded
     */
    function addTollBooth(address tollBooth)
        public
        fromOwner()
        returns(bool success) {
          require(tollBooths[tollBooth].addresslocation != tollBooth);
          require(tollBooth != address(0));
          tollBooths[tollBooth].addresslocation = tollBooth;
          LogTollBoothAdded(msg.sender, tollBooth);
          return true;
        }

    /*
     * @param tollBooth The address of the toll booth we enquire about.
     * @return Whether the toll booth is indeed part of the operator.
     */
    function isTollBooth(address tollBooth)
        constant
        public
        returns(bool isIndeed) {
          if(tollBooths[tollBooth].addresslocation == tollBooth) {
            return true;
          }
          return false;
        }

    /*
     * Event emitted when a toll booth has been removed from the TollBoothOperator.
     * @param sender The account that ran the action.
     * @param tollBooth The toll booth just removed.
     */
    event LogTollBoothRemoved(
        address indexed sender,
        address indexed tollBooth);

    /*
     * Called by the owner of the TollBoothOperator.
     *     It should roll back if the caller is not the owner of the contract. x
     *     It should roll back if the argument has already been removed. x
     *     It should roll back if the argument is a 0x address. x
     *     When part of TollBoothOperatorI, it should be possible to remove toll booth even when
     *       the contract is paused.
     * @param tollBooth The toll booth to remove.
     * @return Whether the action was successful.
     * Emits LogTollBoothRemoved
     */

     
    function removeTollBooth(address tollBooth)
        public
        fromOwner()
        returns(bool success) {
          require(msg.sender == getOwner());
          require(tollBooths[tollBooth].addresslocation != address(0));
          require(tollBooth != address(0));
          delete tollBooths[tollBooth];
          LogTollBoothRemoved(msg.sender, tollBooth);
          return true;
        }
      /* END:TollBoothHolder */
    /*
     * You need to create:
     *
     * - a contract named `TollBoothHolder` that:
     *     - is `OwnedI`, `TollBoothHolderI`.
     *     - has a constructor that takes no parameter.
     */
}
