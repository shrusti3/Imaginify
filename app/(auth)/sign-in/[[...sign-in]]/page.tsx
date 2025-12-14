import { SignIn } from '@clerk/nextjs'
import React from 'react'

const SignInPage = () => {
  // Add 'fallbackRedirectUrl' to fix the warning
  return <SignIn fallbackRedirectUrl="/" /> 
}

export default SignInPage