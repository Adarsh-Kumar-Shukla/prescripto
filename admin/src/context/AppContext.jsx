import React, { createContext } from 'react'

export const AppContext = createContext()

const AppContextProvider = (props) => {

  const currency = "₹"

  const calculateAge = (dob) => {
    const today = new Date()
    const birthDate = new Date(dob)

    let age = today.getFullYear() - birthDate.getFullYear()
    return age

  }

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

  const slotDateFormatter = (slotDate) => {
    const dateArray = slotDate.split("-")
    const day = dateArray[0]
    const month = months[Number(dateArray[1])-1]
    const year = dateArray[2]
    return `${day} ${month}, ${year}`
  }

  const value = {
    calculateAge, slotDateFormatter, currency
  }

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  )
}

export default AppContextProvider
