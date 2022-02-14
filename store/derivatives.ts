import { actionTree, getterTree } from 'typed-vuex'
import {
  BigNumberInBase,
  BigNumberInWei,
  derivativeMarginToChainMarginToFixed,
  derivativePriceToChainPrice,
  derivativePriceToChainPriceToFixed,
  derivativeQuantityToChainQuantityToFixed
} from '@injectivelabs/utils'
import { StreamOperation, TradeDirection } from '@injectivelabs/ts-types'
import {
  UiDerivativeLimitOrder,
  UiDerivativeMarketSummary,
  UiDerivativeMarketWithToken,
  UiDerivativeOrderbook,
  UiDerivativeTrade,
  UiPosition,
  DerivativeTransformer,
  zeroDerivativeMarketSummary,
  ZERO_IN_BASE,
  ZERO_TO_STRING,
  Change
} from '@injectivelabs/ui-common'
import {
  DerivativeOrderSide,
  DerivativeOrderState
} from '@injectivelabs/derivatives-consumer'
import {
  streamOrderbook,
  cancelMarketStreams,
  streamTrades,
  streamSubaccountOrders,
  streamSubaccountTrades,
  streamSubaccountPositions,
  streamMarketMarkPrice
} from '~/app/streams/derivatives'
import {
  FEE_RECIPIENT,
  ORDERBOOK_STREAMING_ENABLED
} from '~/app/utils/constants'
import {
  derivativeActionServiceFactory,
  derivativeService,
  tokenService
} from '~/app/Services'
import { derivatives as allowedPerpetualMarkets } from '~/routes.config'

const initialStateFactory = () => ({
  markets: [] as UiDerivativeMarketWithToken[],
  marketsSummary: [] as UiDerivativeMarketSummary[],
  market: undefined as UiDerivativeMarketWithToken | undefined,
  marketMarkPrice: ZERO_TO_STRING as string,
  marketSummary: undefined as UiDerivativeMarketSummary | undefined,
  orderbook: undefined as UiDerivativeOrderbook | undefined,
  trades: [] as UiDerivativeTrade[],
  subaccountPosition: undefined as UiPosition | undefined,
  subaccountTrades: [] as UiDerivativeTrade[],
  subaccountOrders: [] as UiDerivativeLimitOrder[]
})

const initialState = initialStateFactory()

export const state = () => ({
  markets: initialState.markets as UiDerivativeMarketWithToken[],
  marketsSummary: initialState.marketsSummary as UiDerivativeMarketSummary[],
  market: initialState.market as UiDerivativeMarketWithToken | undefined,
  marketSummary: initialState.marketSummary as
    | UiDerivativeMarketSummary
    | undefined,
  marketMarkPrice: initialState.marketMarkPrice as string,
  trades: initialState.trades as UiDerivativeTrade[],
  subaccountTrades: initialState.subaccountTrades as UiDerivativeTrade[],
  subaccountPosition: initialState.subaccountPosition as UiPosition | undefined,
  subaccountOrders: initialState.subaccountOrders as UiDerivativeLimitOrder[],
  orderbook: initialState.orderbook as UiDerivativeOrderbook | undefined
})

export type DerivativeStoreState = ReturnType<typeof state>

export const getters = getterTree(state, {
  marketSelected: (state) => {
    return !!state.market
  },

  lastTradedPrice: (state) => {
    if (!state.market) {
      return ZERO_IN_BASE
    }

    if (state.trades.length === 0) {
      return ZERO_IN_BASE
    }

    const [trade] = state.trades

    return new BigNumberInBase(
      new BigNumberInWei(trade.executionPrice).toBase(
        state.market.quoteToken.decimals
      )
    )
  },

  lastTradedPriceChange: (state): Change => {
    if (!state.market) {
      return Change.NoChange
    }

    if (state.trades.length === 0) {
      return Change.NoChange
    }

    const [trade] = state.trades
    const [secondLastTrade] = state.trades.filter(
      (t) => !new BigNumberInBase(t.executionPrice).eq(trade.executionPrice)
    )

    if (!secondLastTrade) {
      return Change.NoChange
    }

    const lastPrice = new BigNumberInBase(trade.executionPrice)
    const secondLastPrice = new BigNumberInBase(secondLastTrade.executionPrice)

    return lastPrice.gte(secondLastPrice) ? Change.Increase : Change.Decrease
  }
})

export const mutations = {
  setMarket(state: DerivativeStoreState, market: UiDerivativeMarketWithToken) {
    state.market = market
  },

  setMarketSummary(
    state: DerivativeStoreState,
    marketSummary: UiDerivativeMarketSummary
  ) {
    state.marketSummary = marketSummary
  },

  setMarketMarkPrice(state: DerivativeStoreState, marketMarkPrice: string) {
    state.marketMarkPrice = marketMarkPrice
  },

  resetMarket(state: DerivativeStoreState) {
    const initialState = initialStateFactory()

    state.market = initialState.market
    state.marketSummary = initialState.marketSummary
    state.marketMarkPrice = initialState.marketMarkPrice
    state.orderbook = initialState.orderbook
    state.trades = initialState.trades
    state.subaccountOrders = initialState.subaccountOrders
    state.subaccountTrades = initialState.subaccountTrades
  },

  setMarkets(
    state: DerivativeStoreState,
    markets: UiDerivativeMarketWithToken[]
  ) {
    state.markets = markets
  },

  setMarketsSummary(
    state: DerivativeStoreState,
    marketsSummary: UiDerivativeMarketSummary[]
  ) {
    state.marketsSummary = marketsSummary
  },

  setTrades(state: DerivativeStoreState, trades: UiDerivativeTrade[]) {
    state.trades = trades
  },

  pushTrade(state: DerivativeStoreState, trade: UiDerivativeTrade) {
    state.trades = [trade, ...state.trades]
  },

  setSubaccountPosition(
    state: DerivativeStoreState,
    subaccountPosition: UiPosition
  ) {
    state.subaccountPosition = subaccountPosition
  },

  deleteSubaccountPosition(state: DerivativeStoreState) {
    state.subaccountPosition = undefined
  },

  setSubaccountTrades(
    state: DerivativeStoreState,
    subaccountTrades: UiDerivativeTrade[]
  ) {
    state.subaccountTrades = subaccountTrades
  },

  setSubaccountOrders(
    state: DerivativeStoreState,
    subaccountOrders: UiDerivativeLimitOrder[]
  ) {
    state.subaccountOrders = subaccountOrders
  },

  pushSubaccountOrder(
    state: DerivativeStoreState,
    subaccountOrder: UiDerivativeLimitOrder
  ) {
    state.subaccountOrders = [subaccountOrder, ...state.subaccountOrders]
  },

  updateSubaccountOrder(
    state: DerivativeStoreState,
    subaccountOrder: UiDerivativeLimitOrder
  ) {
    const index = state.subaccountOrders.findIndex(
      (order) => order.orderHash === subaccountOrder.orderHash
    )

    if (index > 0) {
      state.subaccountOrders = [...state.subaccountOrders].splice(
        index,
        1,
        subaccountOrder
      )
    }
  },

  pushOrUpdateSubaccountOrder(
    state: DerivativeStoreState,
    subaccountOrder: UiDerivativeLimitOrder
  ) {
    const subaccountOrders = [...state.subaccountOrders].filter(
      (order) => order.orderHash !== subaccountOrder.orderHash
    )

    state.subaccountOrders = [subaccountOrder, ...subaccountOrders]
  },

  deleteSubaccountOrder(
    state: DerivativeStoreState,
    subaccountOrder: UiDerivativeLimitOrder
  ) {
    const subaccountOrders = [...state.subaccountOrders].filter(
      (order) => order.orderHash !== subaccountOrder.orderHash
    )

    state.subaccountOrders = subaccountOrders
  },

  pushSubaccountTrade(
    state: DerivativeStoreState,
    subaccountTrade: UiDerivativeTrade
  ) {
    state.subaccountTrades = [subaccountTrade, ...state.subaccountTrades]
  },

  updateSubaccountTrade(
    state: DerivativeStoreState,
    subaccountTrade: UiDerivativeTrade
  ) {
    const index = state.subaccountTrades.findIndex(
      (order) => order.orderHash === subaccountTrade.orderHash
    )

    if (index > 0) {
      state.subaccountTrades = [...state.subaccountTrades].splice(
        index,
        1,
        subaccountTrade
      )
    }
  },

  deleteSubaccountTrade(
    state: DerivativeStoreState,
    subaccountTrade: UiDerivativeTrade
  ) {
    const subaccountTrades = [...state.subaccountTrades].filter(
      (order) => order.orderHash !== subaccountTrade.orderHash
    )

    state.subaccountTrades = subaccountTrades
  },

  setOrderbook(state: DerivativeStoreState, orderbook: UiDerivativeOrderbook) {
    state.orderbook = orderbook
  },

  resetSubaccount(state: DerivativeStoreState) {
    const initialState = initialStateFactory()

    state.subaccountTrades = initialState.subaccountTrades
    state.subaccountOrders = initialState.subaccountOrders
    state.subaccountPosition = initialState.subaccountPosition
  }
}

export const actions = actionTree(
  { state, mutations },
  {
    reset({ commit }) {
      commit('resetMarket')
      cancelMarketStreams()
    },

    async init({ commit }) {
      const markets = await derivativeService.fetchMarkets()
      const marketsWithToken = await tokenService.getDerivativeMarketsWithToken(
        markets
      )
      const uiMarkets = DerivativeTransformer.derivativeMarketsToUiSpotMarkets(
        marketsWithToken
      )

      // Only include markets that we pre-defined to generate static routes for
      const uiMarketsWithToken = uiMarkets
        .filter((market) => {
          return allowedPerpetualMarkets.includes(market.slug)
        })
        .sort((a, b) => {
          return (
            allowedPerpetualMarkets.indexOf(a.slug) -
            allowedPerpetualMarkets.indexOf(b.slug)
          )
        })

      commit('setMarkets', uiMarketsWithToken)

      const marketsSummary = await derivativeService.fetchMarketsSummary()
      const marketSummaryNotExists =
        !marketsSummary || (marketsSummary && marketsSummary.length === 0)
      const actualMarketsSummary = marketSummaryNotExists
        ? markets.map((market) => zeroDerivativeMarketSummary(market.marketId))
        : marketsSummary

      commit(
        'setMarketsSummary',
        actualMarketsSummary as UiDerivativeMarketSummary[]
      )
    },

    async initMarket({ commit, state }, marketSlug: string) {
      const { markets } = state

      if (!markets.length) {
        await this.app.$accessor.derivatives.init()
      }

      const { markets: newMarkets } = state
      const market = newMarkets.find(
        (market) => market.slug.toLowerCase() === marketSlug.toLowerCase()
      )

      if (!market) {
        throw new Error('Market not found. Please refresh the page.')
      }

      commit('setMarket', market)
      commit(
        'setMarketSummary',
        await derivativeService.fetchMarketSummary(market.marketId)
      )
      commit(
        'setMarketMarkPrice',
        await derivativeService.fetchMarketMarkPrice(market)
      )

      if (ORDERBOOK_STREAMING_ENABLED) {
        await this.app.$accessor.derivatives.streamOrderbook()
      }
    },

    async initMarketStreams({ commit, state }) {
      const { market } = state

      if (!market) {
        return
      }

      await this.app.$accessor.derivatives.streamTrades()
      await this.app.$accessor.derivatives.streamMarketMarkPrices()
      await this.app.$accessor.derivatives.streamSubaccountOrders()
      await this.app.$accessor.derivatives.streamSubaccountPositions()
      await this.app.$accessor.derivatives.streamSubaccountTrades()
      await this.app.$accessor.account.streamSubaccountBalances()
    },

    async pollOrderbook({ commit, state }) {
      const { market } = state

      if (!market) {
        return
      }

      commit(
        'setOrderbook',
        await derivativeService.fetchOrderbook(market.marketId)
      )
    },

    streamOrderbook({ commit, state }) {
      const { market } = state

      if (!market) {
        return
      }

      streamOrderbook({
        marketId: market.marketId,
        callback: ({ orderbook }) => {
          if (!orderbook) {
            return
          }

          commit('setOrderbook', orderbook)
        }
      })
    },

    streamTrades({ commit, state }) {
      const { market } = state

      if (!market) {
        return
      }

      streamTrades({
        marketId: market.marketId,
        callback: ({ trade, operation }) => {
          if (!trade) {
            return
          }

          switch (operation) {
            case StreamOperation.Insert:
              commit('pushTrade', trade)
          }
        }
      })
    },

    streamMarketMarkPrices({ commit, state }) {
      const { market } = state

      if (!market) {
        return
      }

      streamMarketMarkPrice({
        market,
        callback: ({ price, operation }) => {
          if (!price) {
            return
          }

          switch (operation) {
            case StreamOperation.Update:
              commit('setMarketMarkPrice', price)
          }
        }
      })
    },

    streamSubaccountOrders({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      streamSubaccountOrders({
        marketId: market.marketId,
        subaccountId: subaccount.subaccountId,
        callback: ({ order }) => {
          if (!order) {
            return
          }

          switch (order.state) {
            case DerivativeOrderState.Booked:
              commit('pushOrUpdateSubaccountOrder', order)
              break
            case DerivativeOrderState.Unfilled:
              commit('pushOrUpdateSubaccountOrder', order)
              break
            case DerivativeOrderState.PartialFilled:
              commit('pushOrUpdateSubaccountOrder', order)
              break
            case DerivativeOrderState.Canceled:
              commit('deleteSubaccountOrder', order)
              break
            case DerivativeOrderState.Filled:
              commit('deleteSubaccountOrder', order)
              break
          }
        }
      })
    },

    streamSubaccountTrades({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      streamSubaccountTrades({
        marketId: market.marketId,
        subaccountId: subaccount.subaccountId,
        callback: ({ trade, operation }) => {
          if (!trade) {
            return
          }

          switch (operation) {
            case StreamOperation.Insert:
              commit('pushSubaccountTrade', trade)
              break
            case StreamOperation.Delete:
              commit('deleteSubaccountTrade', trade)
              break
            case StreamOperation.Update:
              commit('updateSubaccountTrade', trade)
              break
          }
        }
      })
    },

    streamSubaccountPositions({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      streamSubaccountPositions({
        marketId: market.marketId,
        subaccountId: subaccount.subaccountId,
        callback: ({ position }) => {
          const quantity = new BigNumberInBase(position ? position.quantity : 0)

          if (!position || quantity.lte(0)) {
            commit('deleteSubaccountPosition')
          } else {
            commit('setSubaccountPosition', position)
          }
        }
      })
    },

    async fetchOrderbook({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      commit(
        'setOrderbook',
        await derivativeService.fetchOrderbook(market.marketId)
      )
    },

    async fetchTrades({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      commit(
        'setTrades',
        await derivativeService.fetchTrades({ marketId: market.marketId })
      )
    },

    async fetchSubaccountOrders({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      commit(
        'setSubaccountOrders',
        await derivativeService.fetchOrders({
          marketId: market.marketId,
          subaccountId: subaccount.subaccountId
        })
      )
    },

    async fetchSubaccountPosition({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      const [position] = await derivativeService.fetchPositions({
        marketId: market.marketId,
        subaccountId: subaccount.subaccountId
      })

      commit('setSubaccountPosition', position)
    },

    async fetchMarketsSummary({ state, commit }) {
      const { marketsSummary, markets, market } = state

      if (marketsSummary.length === 0) {
        return
      }

      const updatedMarketsSummary = await derivativeService.fetchMarketsSummary()
      const combinedMarketsSummary = DerivativeTransformer.marketsSummaryComparisons(
        updatedMarketsSummary,
        state.marketsSummary
      )

      if (
        !combinedMarketsSummary ||
        (combinedMarketsSummary && combinedMarketsSummary.length === 0)
      ) {
        commit(
          'setMarketsSummary',
          markets.map((market) => zeroDerivativeMarketSummary(market.marketId))
        )
      } else {
        if (market) {
          const updatedMarketSummary = combinedMarketsSummary.find(
            (m) => m.marketId === market.marketId
          )

          if (updatedMarketSummary) {
            commit('setMarketSummary', updatedMarketSummary)
          }
        }

        commit('setMarketsSummary', combinedMarketsSummary)
      }
    },

    async fetchMarket({ state, commit }) {
      const { market } = state

      if (!market) {
        return
      }

      const updatedMarket = await derivativeService.fetchMarket(market.marketId)

      commit('setMarket', {
        ...updatedMarket,
        ...market
      })
    },

    async fetchSubaccountTrades({ state, commit }) {
      const { market } = state
      const { subaccount } = this.app.$accessor.account
      const { isUserWalletConnected } = this.app.$accessor.wallet

      if (!market) {
        return
      }

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      const trades = await derivativeService.fetchTrades({
        marketId: market.marketId,
        subaccountId: subaccount.subaccountId
      })

      commit('setSubaccountTrades', trades)
    },

    async cancelOrder(_, order: UiDerivativeLimitOrder) {
      const { subaccount } = this.app.$accessor.account
      const {
        address,
        injectiveAddress,
        isUserWalletConnected
      } = this.app.$accessor.wallet
      const derivativeActionService = derivativeActionServiceFactory()

      if (!isUserWalletConnected || !subaccount) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      await derivativeActionService.cancelOrder({
        injectiveAddress,
        address,
        orderHash: order.orderHash,
        marketId: order.marketId,
        subaccountId: subaccount.subaccountId
      })
    },

    async batchCancelOrder(_, orders: UiDerivativeLimitOrder[]) {
      const { subaccount } = this.app.$accessor.account
      const { market } = this.app.$accessor.derivatives
      const {
        address,
        injectiveAddress,
        isUserWalletConnected
      } = this.app.$accessor.wallet
      const derivativeActionService = derivativeActionServiceFactory()

      if (!isUserWalletConnected || !subaccount || !market) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      await derivativeActionService.batchCancelOrders({
        injectiveAddress,
        address,
        orders: orders.map((o) => ({
          orderHash: o.orderHash,
          subaccountId: o.subaccountId,
          marketId: o.marketId
        }))
      })
    },

    async submitLimitOrder(
      _,
      {
        price,
        reduceOnly,
        margin,
        quantity,
        orderType
      }: {
        reduceOnly: boolean
        price: BigNumberInBase
        margin: BigNumberInBase
        quantity: BigNumberInBase
        orderType: DerivativeOrderSide
      }
    ) {
      const { subaccount } = this.app.$accessor.account
      const { market } = this.app.$accessor.derivatives
      const {
        address,
        injectiveAddress,
        isUserWalletConnected
      } = this.app.$accessor.wallet
      const derivativeActionService = derivativeActionServiceFactory()

      if (!isUserWalletConnected || !subaccount || !market) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      await derivativeActionService.submitLimitOrder({
        reduceOnly,
        orderType,
        injectiveAddress,
        address,
        price: derivativePriceToChainPriceToFixed({
          value: price,
          quoteDecimals: market.quoteToken.decimals
        }),
        quantity: derivativeQuantityToChainQuantityToFixed({ value: quantity }),
        margin: derivativeMarginToChainMarginToFixed({
          value: margin,
          quoteDecimals: market.quoteToken.decimals
        }),
        marketId: market.marketId,
        feeRecipient: FEE_RECIPIENT,
        subaccountId: subaccount.subaccountId
      })
    },

    async submitMarketOrder(
      _,
      {
        quantity,
        price,
        margin,
        reduceOnly,
        orderType
      }: {
        reduceOnly: boolean
        price: BigNumberInBase
        margin: BigNumberInBase
        quantity: BigNumberInBase
        orderType: DerivativeOrderSide
      }
    ) {
      const { subaccount } = this.app.$accessor.account
      const { market } = this.app.$accessor.derivatives
      const {
        address,
        injectiveAddress,
        isUserWalletConnected
      } = this.app.$accessor.wallet
      const derivativeActionService = derivativeActionServiceFactory()

      if (!isUserWalletConnected || !subaccount || !market) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      await derivativeActionService.submitMarketOrder({
        reduceOnly,
        orderType,
        injectiveAddress,
        address,
        price: derivativePriceToChainPriceToFixed({
          value: price,
          quoteDecimals: market.quoteToken.decimals
        }),
        quantity: derivativeQuantityToChainQuantityToFixed({ value: quantity }),
        margin: derivativeMarginToChainMarginToFixed({
          value: margin,
          quoteDecimals: market.quoteToken.decimals
        }),
        marketId: market.marketId,
        feeRecipient: FEE_RECIPIENT,
        subaccountId: subaccount.subaccountId
      })
    },

    async closePosition(
      _,
      {
        market,
        position
      }: {
        market?: UiDerivativeMarketWithToken
        position: UiPosition
      }
    ) {
      const { subaccount } = this.app.$accessor.account
      const { market: currentMarket } = this.app.$accessor.derivatives
      const {
        address,
        injectiveAddress,
        isUserWalletConnected
      } = this.app.$accessor.wallet
      const actualMarket = (currentMarket ||
        market) as UiDerivativeMarketWithToken
      const derivativeActionService = derivativeActionServiceFactory()

      if (!isUserWalletConnected || !subaccount || !actualMarket) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      const orderType =
        position.direction === TradeDirection.Long
          ? DerivativeOrderSide.Sell
          : DerivativeOrderSide.Buy
      const liquidationPrice = new BigNumberInWei(position.liquidationPrice)
      const minTickPrice = derivativePriceToChainPrice({
        value: new BigNumberInBase(1).shiftedBy(-actualMarket.priceDecimals),
        quoteDecimals: actualMarket.quoteToken.decimals
      })
      const actualLiquidationPrice = liquidationPrice.lte(0)
        ? minTickPrice
        : liquidationPrice

      await derivativeActionService.closePosition({
        address,
        orderType,
        injectiveAddress,
        price: actualLiquidationPrice.toFixed(),
        quantity: derivativeQuantityToChainQuantityToFixed({
          value: position.quantity
        }),
        feeRecipient: FEE_RECIPIENT,
        marketId: position.marketId,
        subaccountId: subaccount.subaccountId
      })
    },

    async closePositionAndReduceOnlyOrders(
      _,
      {
        market,
        position
      }: {
        market?: UiDerivativeMarketWithToken
        position: UiPosition
        reduceOnlyOrders: UiDerivativeLimitOrder[]
      }
    ) {
      const { subaccount } = this.app.$accessor.account
      const { market: currentMarket } = this.app.$accessor.derivatives
      const {
        address,
        injectiveAddress,
        isUserWalletConnected
      } = this.app.$accessor.wallet
      const actualMarket = (currentMarket ||
        market) as UiDerivativeMarketWithToken
      const derivativeActionService = derivativeActionServiceFactory()

      if (
        !isUserWalletConnected ||
        !subaccount ||
        (!market && !currentMarket)
      ) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      const orderType =
        position.direction === TradeDirection.Long
          ? DerivativeOrderSide.Sell
          : DerivativeOrderSide.Buy
      const liquidationPrice = new BigNumberInWei(position.liquidationPrice)
      const minTickPrice = derivativePriceToChainPrice({
        value: new BigNumberInBase(1).shiftedBy(-actualMarket.priceDecimals),
        quoteDecimals: actualMarket.quoteToken.decimals
      })
      const actualLiquidationPrice = liquidationPrice.lte(0)
        ? minTickPrice
        : liquidationPrice

      await derivativeActionService.closePosition({
        address,
        orderType,
        injectiveAddress,
        price: actualLiquidationPrice.toFixed(),
        quantity: derivativeQuantityToChainQuantityToFixed({
          value: position.quantity
        }),
        feeRecipient: FEE_RECIPIENT,
        marketId: actualMarket.marketId,
        subaccountId: subaccount.subaccountId
      })
    },

    async closeAllPosition(
      _,
      {
        positions
      }: {
        positions: {
          market: UiDerivativeMarketWithToken
          position: UiPosition
        }[]
      }
    ) {
      const { subaccount } = this.app.$accessor.account
      const {
        address,
        injectiveAddress,
        isUserWalletConnected
      } = this.app.$accessor.wallet
      const derivativeActionService = derivativeActionServiceFactory()

      if (!isUserWalletConnected || !subaccount || positions.length === 0) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      await derivativeActionService.closeAllPosition({
        address,
        injectiveAddress,
        positions: positions.map(({ position, market }) => {
          const orderType =
            position.direction === TradeDirection.Long
              ? DerivativeOrderSide.Sell
              : DerivativeOrderSide.Buy
          const liquidationPrice = new BigNumberInWei(position.liquidationPrice)
          const minTickPrice = derivativePriceToChainPrice({
            value: new BigNumberInBase(1).shiftedBy(-market.priceDecimals),
            quoteDecimals: market.quoteToken.decimals
          })
          const actualLiquidationPrice = liquidationPrice.lte(0)
            ? minTickPrice
            : liquidationPrice

          return {
            orderType,
            marketId: market.marketId,
            price: actualLiquidationPrice.toFixed(),
            quantity: derivativeQuantityToChainQuantityToFixed({
              value: position.quantity
            })
          }
        }),
        feeRecipient: FEE_RECIPIENT,
        subaccountId: subaccount.subaccountId
      })
    },

    async addMarginToPosition(
      _,
      {
        market,
        amount
      }: {
        market: UiDerivativeMarketWithToken
        amount: BigNumberInBase
      }
    ) {
      const { subaccount } = this.app.$accessor.account
      const {
        address,
        injectiveAddress,
        isUserWalletConnected
      } = this.app.$accessor.wallet
      const derivativeActionService = derivativeActionServiceFactory()

      if (!isUserWalletConnected || !subaccount || !market) {
        return
      }

      await this.app.$accessor.app.queue()
      await this.app.$accessor.wallet.validate()

      await derivativeActionService.addMarginToPosition({
        address,
        injectiveAddress,
        amount: derivativeMarginToChainMarginToFixed({
          value: amount,
          quoteDecimals: market.quoteToken.decimals
        }),
        marketId: market.marketId,
        feeRecipient: FEE_RECIPIENT,
        srcSubaccountId: subaccount.subaccountId,
        dstSubaccountId: subaccount.subaccountId
      })
    }
  }
)
