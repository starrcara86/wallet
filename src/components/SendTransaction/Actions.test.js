import { getErrorMessage, execute } from './Actions'

// Mock dependencies
jest.mock('lib/getWallet', () => ({
  getWallet: jest.fn()
}))
jest.mock('ambire-common/src/services/provider', () => ({
  getProvider: jest.fn()
}))
jest.mock('./noRelayer', () => ({
  sendNoRelayer: jest.fn()
}))

const { getWallet } = require('lib/getWallet')
const { getProvider } = require('ambire-common/src/services/provider')
const { sendNoRelayer } = require('./noRelayer')

describe('getErrorMessage', () => {
  test('returns user-friendly message for NOT_TIME error', () => {
    const e = { message: 'NOT_TIME' }
    expect(getErrorMessage(e)).toContain('72 hour recovery')
  })

  test('returns user-friendly message for WRONG_ACC_OR_NO_PRIV error', () => {
    const e = { message: 'WRONG_ACC_OR_NO_PRIV' }
    expect(getErrorMessage(e)).toContain('email/password account')
  })

  test('returns user-friendly message for INVALID_SIGNATURE error', () => {
    const e = { message: 'INVALID_SIGNATURE' }
    expect(getErrorMessage(e)).toContain('Invalid signature')
  })

  test('returns user-friendly message for INSUFFICIENT_PRIVILEGE error', () => {
    const e = { message: 'INSUFFICIENT_PRIVILEGE' }
    expect(getErrorMessage(e)).toContain('Wrong signature')
  })

  test('returns the original message for unknown errors', () => {
    const e = { message: 'Something went wrong' }
    expect(getErrorMessage(e)).toBe('Something went wrong')
  })

  test('returns the error itself if no message property', () => {
    const e = 'raw error string'
    expect(getErrorMessage(e)).toBe('raw error string')
  })
})

describe('execute', () => {
  const mockNetwork = { id: 'ethereum', chainId: 1 }
  const mockAccount = { signerExtra: null }
  const mockSigner = { address: '0x123' }
  const mockProvider = {}
  const mockWallet = {
    signMessage: jest.fn()
  }
  const mockFinalBundle = {
    signer: mockSigner,
    sign: jest.fn(),
    submit: jest.fn()
  }

  beforeEach(() => {
    jest.clearAllMocks()
    getProvider.mockReturnValue(mockProvider)
    getWallet.mockReturnValue(mockWallet)
  })

  test('signs and submits via relayer when relayerURL is provided', async () => {
    const relayerURL = 'https://relayer.ambire.com'
    const mockResult = { success: true, txId: '0xabc' }
    mockFinalBundle.submit.mockResolvedValue(mockResult)

    const result = await execute({
      finalBundle: mockFinalBundle,
      account: mockAccount,
      network: mockNetwork,
      relayerURL,
      estimation: null,
      feeSpeed: 'fast'
    })

    expect(getWallet).toHaveBeenCalledWith({
      signer: mockSigner,
      signerExtra: null,
      chainId: mockNetwork.chainId
    })
    expect(mockFinalBundle.sign).toHaveBeenCalledWith(mockWallet)
    expect(mockFinalBundle.submit).toHaveBeenCalledWith({ relayerURL, fetch })
    expect(result).toEqual(mockResult)
  })

  test('calls sendNoRelayer when no relayerURL provided', async () => {
    const mockEstimation = { gasLimit: 21000 }
    const mockResult = { success: true, txId: '0xdef' }
    sendNoRelayer.mockResolvedValue(mockResult)

    const result = await execute({
      finalBundle: mockFinalBundle,
      account: mockAccount,
      network: mockNetwork,
      relayerURL: null,
      estimation: mockEstimation,
      feeSpeed: 'fast'
    })

    expect(sendNoRelayer).toHaveBeenCalledWith({
      finalBundle: mockFinalBundle,
      account: mockAccount,
      network: mockNetwork,
      wallet: mockWallet,
      estimation: mockEstimation,
      feeSpeed: 'fast',
      provider: mockProvider
    })
    expect(result).toEqual(mockResult)
  })

  test('calls onUnlockRequired when wallet is locked', async () => {
    const lockedWallet = {
      ...mockWallet,
      isUnlocked: jest.fn().mockResolvedValue(false)
    }
    getWallet.mockReturnValue(lockedWallet)

    const onUnlockRequired = jest.fn()
    mockFinalBundle.submit.mockResolvedValue({ success: true, txId: '0xabc' })

    await execute({
      finalBundle: mockFinalBundle,
      account: mockAccount,
      network: mockNetwork,
      relayerURL: 'https://relayer.ambire.com',
      estimation: null,
      feeSpeed: 'fast',
      onUnlockRequired
    })

    expect(onUnlockRequired).toHaveBeenCalled()
  })

  test('does not call onUnlockRequired when wallet is unlocked', async () => {
    const unlockedWallet = {
      ...mockWallet,
      isUnlocked: jest.fn().mockResolvedValue(true)
    }
    getWallet.mockReturnValue(unlockedWallet)

    const onUnlockRequired = jest.fn()
    mockFinalBundle.submit.mockResolvedValue({ success: true, txId: '0xabc' })

    await execute({
      finalBundle: mockFinalBundle,
      account: mockAccount,
      network: mockNetwork,
      relayerURL: 'https://relayer.ambire.com',
      estimation: null,
      feeSpeed: 'fast',
      onUnlockRequired
    })

    expect(onUnlockRequired).not.toHaveBeenCalled()
  })
})
