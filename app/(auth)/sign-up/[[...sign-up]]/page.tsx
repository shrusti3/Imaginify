import { SignUp } from '@clerk/nextjs'
import React from 'react'

const SignUpPage = () => {
  // Add 'fallbackRedirectUrl' here too
  return <SignUp fallbackRedirectUrl="/" />
}

export default SignUpPage