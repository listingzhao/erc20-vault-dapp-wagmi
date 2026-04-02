import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia } from 'wagmi/chains'

export const config = getDefaultConfig({
  appName: 'ERC20 Vault DApp',
  projectId: 'e64ec20bad16c3c97a3e51a12ca3f962',
  chains: [sepolia],
  ssr: false,
})