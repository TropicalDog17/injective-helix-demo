<script lang="ts" setup>
import { UiPosition, BalanceWithToken } from '@injectivelabs/sdk-ui-ts'
import { GeneralException } from '@injectivelabs/exceptions'
import { AccountBalance, Modal } from '@/types'

defineProps({
  isHideBalances: Boolean,
  isPositionsLoading: Boolean,

  balances: {
    type: Array as PropType<AccountBalance[]>,
    required: true
  }
})

const modalStore = useModalStore()
const accountStore = useAccountStore()
const positionStore = usePositionStore()
const derivativeStore = useDerivativeStore()
const { t } = useLang()
const { $onError } = useNuxtApp()
const { success } = useNotifications()

const sideOptions = [
  {
    display: t('account.positions.side.short'),
    value: 'short'
  },
  {
    display: t('account.positions.side.long'),
    value: 'long'
  }
]

const side = ref('')
const marketDenom = ref('')
const selectedPosition = ref<UiPosition | undefined>(undefined)

const markets = computed(() => derivativeStore.markets)
const positions = computed(() => positionStore.subaccountPositions)

const marketIds = computed(() => {
  if (!marketDenom.value) {
    return []
  }

  return markets.value
    .filter((m) => {
      return (
        m.baseToken.denom === marketDenom.value ||
        m.quoteToken.denom === marketDenom.value
      )
    })
    .map(({ marketId }) => marketId)
})

const filteredPositions = computed(() =>
  positionStore.subaccountPositions.filter((position) => {
    const positionMatchedSide = !side.value || position.direction === side.value
    const positionMatchedMarket =
      marketIds.value.length === 0 ||
      marketIds.value.includes(position.marketId)

    return positionMatchedMarket && positionMatchedSide
  })
)

const supportedTokens = computed(() => {
  const tokens = markets.value.reduce((tokens, market) => {
    const baseToken = {
      balance: '',
      denom: market.baseToken.denom,
      token: market.baseToken
    } as BalanceWithToken

    const quoteToken = {
      balance: '',
      denom: market.quoteDenom,
      token: market.quoteToken
    } as BalanceWithToken

    return [...tokens, baseToken, quoteToken]
  }, [] as BalanceWithToken[])

  const uniqueTokens = [
    ...new Map(tokens.map((token) => [token.denom, token])).values()
  ]

  return uniqueTokens
})

const marketOptions = computed(() =>
  supportedTokens.value.map(({ token }) => {
    return {
      display: token.symbol,
      value: token.denom
    }
  })
)

const isEmpty = computed(() => {
  if (filteredPositions.value.length === 0) {
    return true
  }

  const hasUnavailableMarkets = filteredPositions.value.every(
    (position) =>
      markets.value.findIndex((m) => m.marketId === position.marketId) === -1
  )

  return hasUnavailableMarkets
})

onBeforeUnmount(() => {
  derivativeStore.cancelMarketsMarkPrices()
  positionStore.cancelSubaccountPositionsStream()
})

function onCloseAllPositions() {
  return positions.value.length === 1 ? closePosition() : closeAllPositions()
}

function closeAllPositions() {
  positionStore
    .closeAllPosition(positions.value)
    .then(() => {
      success({
        title: t('trade.positions_closed')
      })
    })
    .catch($onError)
}

function closePosition() {
  const [position] = positions.value
  const market = markets.value.find((m) => m.marketId === position.marketId)

  if (!market) {
    throw new GeneralException(
      Error(
        t('trade.position_market_not_found', {
          marketId: position.marketId
        })
      )
    )
  }

  positionStore
    .closePosition({
      position,
      market
    })
    .then(() => {
      success({
        title: t('trade.positions_closed')
      })
    })
    .catch($onError)
}

function onSharePosition(position: UiPosition) {
  selectedPosition.value = position
  modalStore.openModal(Modal.SharePosition)
}

watch(
  () => accountStore.subaccountId,
  () => {
    positionStore.fetchSubaccountPositions()
  }
)
</script>
<template>
  <div class="bg-black p-6 rounded-lg shadow-md">
    <div class="flex justify-between items-center mb-6">
      <h2 class="text-xl font-bold">PnL Analysis</h2>
      <div class="flex">
        <button class="px-4 py-2 bg-gray-200 rounded-l-md focus:outline-none">
          Standard Futures
        </button>
        <button class="px-4 py-2 bg-gray-200 rounded-r-md focus:outline-none">
          USDT-M Perp Futures
        </button>
      </div>
    </div>

    <div class="mb-6">
      <p class="text-4xl font-bold">194.40</p>
      <p class="text-gray-500">Total Asset Value (USD)</p>
    </div>

    <div class="grid grid-cols-3 gap-4 mb-8">
      <div>
        <p class="text-lg font-bold">-2.02</p>
        <p class="text-sm text-gray-500">Today's PnL</p>
        <p class="text-sm text-gray-500">-1.03%</p>
      </div>
      <div>
        <p class="text-lg font-bold">-9.82</p>
        <p class="text-sm text-gray-500">7D PnL</p>
        <p class="text-sm text-gray-500">-1.60%</p>
      </div>
      <div>
        <p class="text-lg font-bold">-27.76</p>
        <p class="text-sm text-gray-500">30D PnL</p>
        <p class="text-sm text-gray-500">-9.58%</p>
      </div>
    </div>

    <div class="flex justify-between mb-6">
      <button class="px-4 py-2 bg-blue-200 rounded-md focus:outline-none">
        PnL Analysis
      </button>
      <button class="px-4 py-2 bg-blue-200 rounded-md focus:outline-none">
        PnL Calendar
      </button>
      <button class="px-4 py-2 bg-blue-200 rounded-md focus:outline-none">
        Assets Distribution
      </button>
    </div>

    <div class="flex justify-between mb-6">
      <button class="px-4 py-2 bg-blue-200 rounded-md focus:outline-none">
        Last 7D
      </button>
      <button class="px-4 py-2 bg-blue-200 rounded-md focus:outline-none">
        Last 30D
      </button>
      <button class="px-4 py-2 bg-blue-200 rounded-md focus:outline-none">
        Last 90D
      </button>
      <button class="px-4 py-2 bg-blue-200 rounded-md focus:outline-none">
        Custom
      </button>
    </div>

    <div class="mb-6">
      <h3 class="text-lg font-bold mb-2">Statistics</h3>
      <div class="grid grid-cols-2 gap-4">
        <div>
          <p class="text-sm text-gray-500">Total Profit</p>
          <p class="text-lg font-bold">10.98 USD</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">Total Loss</p>
          <p class="text-lg font-bold">-20.81 USD</p>
        </div>
        <div>
          <p class="text-sm text-gray-500">Net PnL</p>
          <p class="text-lg font-bold">-9.82 USD</p>
        </div>
      </div>
      <button class="mt-2 text-blue-500 focus:outline-none">Details</button>
    </div>

    <div class="mb-6">
      <h3 class="text-lg font-bold mb-2">Asset Trend</h3>
      <img
        src="path/to/asset-trend-chart.png"
        alt="Asset Trend Chart"
        class="w-full"
      />
    </div>

    <div>
      <h3 class="text-lg font-bold mb-2">Daily PnL</h3>
      <img
        src="path/to/daily-pnl-chart.png"
        alt="Daily PnL Chart"
        class="w-full"
      />
    </div>
  </div>
</template>
