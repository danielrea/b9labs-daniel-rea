pragma solidity ^0.4.13;
import "./Owned.sol";
import "./interfaces/RoutePriceHolderI.sol";
import "./TollBoothHolder.sol";

contract RoutePriceHolder is Owned, RoutePriceHolderI, TollBoothHolder {
    struct Route {
      address entryBooth;
      address exitBooth;
      uint priceWeis;
    }
    mapping(bytes32=>Route) routes;

    function RoutePriceHolder() {

    }
    /*
     * Event emitted when a new price has been set on a route.
     * @param sender The account that ran the action.
     * @param entryBooth The address of the entry booth of the route set.
     * @param exitBooth The address of the exit booth of the route set.
     * @param priceWeis The price in weis of the new route.
     */
    event LogRoutePriceSet(
        address indexed sender,
        address indexed entryBooth,
        address indexed exitBooth,
        uint priceWeis);

    /*
     * Called by the owner of the RoutePriceHolder.
     *     It can be used to update the price of a route, including to zero.
     *     It should roll back if the caller is not the owner of the contract. x
     *     It should roll back if one of the booths is not a registered booth. x
     *     It should roll back if entry and exit booths are the same. x
     *     It should roll back if either booth is a 0x address. x
     *     It should roll back if there is no change in price. x
     * @param entryBooth The address of the entry booth of the route set.
     * @param exitBooth The address of the exit booth of the route set.
     * @param priceWeis The price in weis of the new route.
     * @return Whether the action was successful.
     * Emits LogPriceSet.
     */
    function setRoutePrice(
            address entryBooth,
            address exitBooth,
            uint priceWeis)
        public
        fromOwner()
        returns(bool success) {
          require(isTollBooth(entryBooth));
          require(isTollBooth(exitBooth));
          require(entryBooth != exitBooth);
          require(entryBooth != address(0));
          require(exitBooth != address(0));
          bytes32 keccakHash = keccak256(entryBooth, exitBooth);
          require(routes[keccakHash].priceWeis != priceWeis);
          routes[keccakHash].entryBooth = entryBooth;
          routes[keccakHash].exitBooth = exitBooth;
          routes[keccakHash].priceWeis = priceWeis;
          LogRoutePriceSet(msg.sender, entryBooth, exitBooth, priceWeis);
          return true;
        }

    /*
     * @param entryBooth The address of the entry booth of the route.
     * @param exitBooth The address of the exit booth of the route.
     * @return priceWeis The price in weis of the route.
     *     If the route is not known or if any address is not a booth it should return 0.
     *     If the route is invalid, it should return 0.
     */
    function getRoutePrice(
            address entryBooth,
            address exitBooth)
        constant
        public
        returns(uint priceWeis) {
          if(isTollBooth(entryBooth) && isTollBooth(exitBooth)) {
            bytes32 keccakhash = keccak256(entryBooth, exitBooth);
            return routes[keccakhash].priceWeis;
          }
          return 0;
        }

    /*
     * You need to create:
     *
     * - a contract named `RoutePriceHolder` that:
     *     - is `OwnedI`, `TollBoothHolderI`, and `RoutePriceHolderI`.
     *     - has a constructor that takes no parameter.
     */
}
