import { LocalStorage } from '@injectivelabs/utils'
import {
  TokenPrice,
  Web3Client,
  Web3Composer,
  TokenService,
  DenomClientAsync,
  UiBridgeTransformer,
  peggyGraphQlEndpointForNetwork
} from '@injectivelabs/sdk-ui-ts'
import {
  ApolloConsumer,
  ChainGrpcGovApi,
  ChainGrpcBankApi,
  ChainGrpcWasmApi,
  ChainGrpcMintApi,
  ChainGrpcAuthZApi,
  ChainGrpcPeggyApi,
  ChainGrpcOracleApi,
  IndexerGrpcSpotApi,
  ChainGrpcStakingApi,
  ChainGrpcExchangeApi,
  IndexerGrpcOracleApi,
  IndexerGrpcAccountApi,
  IndexerGrpcTradingApi,
  IndexerGrpcCampaignApi,
  IndexerGrpcExplorerApi,
  IndexerRestExplorerApi,
  ChainGrpcDistributionApi,
  IndexerRestSpotChronosApi,
  ChainGrpcInsuranceFundApi,
  IndexerGrpcDerivativesApi,
  IndexerRestMarketChronosApi,
  IndexerGrpcAccountPortfolioApi,
  IndexerRestLeaderboardChronosApi,
  IndexerRestDerivativesChronosApi
} from '@injectivelabs/sdk-ts'
import { MsgBroadcaster, Web3Broadcaster } from '@injectivelabs/wallet-ts'
import { TokenMetaUtilsFactory } from '@injectivelabs/token-metadata'
import {
  NETWORK,
  CHAIN_ID,
  ENDPOINTS,
  ETHEREUM_CHAIN_ID,
  COIN_GECKO_OPTIONS
} from '@/app/utils/constants'
import { alchemyRpcEndpoint, walletStrategy } from '@/app/wallet-strategy'

// Services
export const bankApi = new ChainGrpcBankApi(ENDPOINTS.grpc)
export const wasmApi = new ChainGrpcWasmApi(ENDPOINTS.grpc)
export const mintApi = new ChainGrpcMintApi(ENDPOINTS.grpc)
export const peggyApi = new ChainGrpcPeggyApi(ENDPOINTS.grpc)
export const oracleApi = new ChainGrpcOracleApi(ENDPOINTS.grpc)
export const governanceApi = new ChainGrpcGovApi(ENDPOINTS.grpc)
export const stakingApi = new ChainGrpcStakingApi(ENDPOINTS.grpc)
export const exchangeApi = new ChainGrpcExchangeApi(ENDPOINTS.grpc)
export const insuranceApi = new ChainGrpcInsuranceFundApi(ENDPOINTS.grpc)
export const distributionApi = new ChainGrpcDistributionApi(ENDPOINTS.grpc)
export const authZApi = new ChainGrpcAuthZApi(ENDPOINTS.grpc)
export const chainGrpcWasmApi = new ChainGrpcWasmApi(ENDPOINTS.grpc)

export const indexerOracleApi = new IndexerGrpcOracleApi(ENDPOINTS.indexer)
export const indexerAccountApi = new IndexerGrpcAccountApi(ENDPOINTS.indexer)

export const indexerGrpcCampaignApi = new IndexerGrpcCampaignApi(
  ENDPOINTS.campaign
)
export const indexerAccountPortfolioApi = new IndexerGrpcAccountPortfolioApi(
  ENDPOINTS.indexer
)

/** TODO remove conditional when resync is done */
export const indexerGrpcTradingApi = new IndexerGrpcTradingApi(
  ENDPOINTS.indexer
)

export const indexerExplorerApi = new IndexerGrpcExplorerApi(
  ENDPOINTS.explorer || ENDPOINTS.indexer
)
export const indexerRestExplorerApi = new IndexerRestExplorerApi(
  `${ENDPOINTS.explorer}/api/explorer/v1`
)
export const indexerRestDerivativesChronosApi =
  new IndexerRestDerivativesChronosApi(
    `${ENDPOINTS.chronos}/api/chronos/v1/derivative`
  )
export const indexerRestSpotChronosApi = new IndexerRestSpotChronosApi(
  `${ENDPOINTS.chronos}/api/chronos/v1/spot`
)
export const indexerRestLeaderboardChronosApi =
  new IndexerRestLeaderboardChronosApi(
    `${ENDPOINTS.chronos}/api/chronos/v1/leaderboard`
  )
export const indexerRestMarketChronosApi = new IndexerRestMarketChronosApi(
  `${ENDPOINTS.chronos}/api/chronos/v1/market`
)
export const indexerDerivativesApi = new IndexerGrpcDerivativesApi(
  ENDPOINTS.indexer
)
export const indexerSpotApi = new IndexerGrpcSpotApi(ENDPOINTS.indexer)

export const apolloConsumer = new ApolloConsumer(
  peggyGraphQlEndpointForNetwork(NETWORK)
)

// Transaction broadcaster
export const msgBroadcastClient = new MsgBroadcaster({
  walletStrategy,
  network: NETWORK,
  networkEndpoints: ENDPOINTS,
  // feePayerPubKey: FEE_PAYER_PUB_KEY,
  simulateTx: true
})

export const web3Client = new Web3Client({
  network: NETWORK,
  rpc: alchemyRpcEndpoint
})
export const web3Composer = new Web3Composer({
  network: NETWORK,
  rpc: alchemyRpcEndpoint,
  ethereumChainId: ETHEREUM_CHAIN_ID
})
export const web3Broadcaster = new Web3Broadcaster({
  walletStrategy,
  network: NETWORK,
  ethereumChainId: ETHEREUM_CHAIN_ID
})

// Token Services
export const tokenService = new TokenService({
  chainId: CHAIN_ID,
  network: NETWORK,
  endpoints: ENDPOINTS
})
export const tokenMetaUtils = TokenMetaUtilsFactory.make(NETWORK)
export const tokenPrice = new TokenPrice(COIN_GECKO_OPTIONS)
export const denomClient = new DenomClientAsync(NETWORK, {
  endpoints: ENDPOINTS,
  alchemyRpcUrl: alchemyRpcEndpoint
})

// UI Services
export const bridgeTransformer = new UiBridgeTransformer(NETWORK)

// Singletons
export const localStorage: LocalStorage = new LocalStorage(
  `inj-helix-v1-${NETWORK}`
)
