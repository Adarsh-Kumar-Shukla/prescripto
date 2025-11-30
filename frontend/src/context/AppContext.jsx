import { createContext, useEffect, useState } from "react";
import axios from 'axios'
import { toast } from "react-toastify";


export const AppContext = createContext()

const AppContextProvider = (props) => {

  const currencySymbol = '₹'
  const backendUrl = "https://prescripto-backend-bsob.onrender.com"
  const [doctors,setDoctors] = useState([])
  const [userData,setUserData] = useState(null)
  
  const [token,setToken] = useState(localStorage.getItem("token") || "")

  
  const getDoctorsData = async () => {
    try {
      const {data} = await axios.get(backendUrl + '/api/doctor/list'); // doctors API
      if(data.success){
        setDoctors(data.doctors)
      } else {
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
    }
  }

  const loadUserProfileData = async () => {
    try {
      const {data} = await axios.get(backendUrl + "/api/user/get-profile", { headers: { token } })
      if(data.success){
        setUserData(data.userData)
      }
      else{
        toast.error(data.message)
      }
    } catch (error) {
      console.log(error)
      toast.error(error.message)
    }
  }

  useEffect(()=>{
    getDoctorsData()
  },[])

  useEffect(()=>{
    if (token && token.length > 0) {
    loadUserProfileData();
  } else {
    setUserData(null);
  }
  },[token])

  const value = {
    doctors,getDoctorsData,
    currencySymbol,
    token,
    setToken,
    backendUrl,
    userData,
    setUserData,
    loadUserProfileData
  }

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  )
}

export default AppContextProvider
