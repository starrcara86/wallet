import { getWallet } from 'lib/getWallet'
import { getProvider } from 'ambire-common/src/services/provider'
import { sendNoRelayer } from './noRelayer'

export function getErrorMessage(e) {
  if (e && e.message === 'NOT_TIME') {
    return "Your 72 hour recovery waiting period still hasn't ended. You will be able to use your account after this lock period."
  }
  if (e && e.message === 'WRONG_ACC_OR_NO_PRIV') {
    return 'Unable to sign with this email/password account. Please contact support.'
    // NOTE: is INVALID_SIGNATURE even a real error?
  }
  if (e && e.message === 'INVALID_SIGNATURE') {
    return 'Invalid signature. This may happen if you used password/derivation path on your hardware wallet.'
  }
  if (e && e.message === 'INSUFFICIENT_PRIVILEGE') {
    return 'Wrong signature. This may happen if you used password/derivation path on your hardware wallet.'
  }
  return e.message || e
}

export async function execute({
  finalBundle,
  account,
  network,
  relayerURL,
  estimation,
  feeSpeed,
  onUnlockRequired
}) {
  const provider = getProvider(network.id)
  const signer = finalBundle.signer

  const wallet = getWallet({
    signer,
    signerExtra: account.signerExtra,
    chainId: network.chainId
  })

  if (wallet.isUnlocked && !(await wallet.isUnlocked())) {
    onUnlockRequired && onUnlockRequired()
  }

  if (wallet.web3eth_requestAccounts) {
    const TIME_TO_UNLOCK = 30 * 1000
    let tooLateToUnlock = false
    const timeout = setTimeout(() => {
      tooLateToUnlock = true
    }, TIME_TO_UNLOCK)
    // prompts the user to unlock extension
    await wallet.web3eth_requestAccounts()
    if (tooLateToUnlock) throw new Error('Too slow to unlock web3 wallet')
    clearTimeout(timeout)
  }

  if (relayerURL) {
    await finalBundle.sign(wallet)
    return await finalBundle.submit({ relayerURL, fetch })
  }

  return sendNoRelayer({
    finalBundle,
    account,
    network,
    wallet,
    estimation,
    feeSpeed,
    provider
  })
}
