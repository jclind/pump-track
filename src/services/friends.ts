import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { getUIDFromUsername, getUsername } from './auth'
import { auth, db } from './firestore'
import {
  CombinedRequestedFriendDataType,
  FriendsData,
  FriendsStatusType,
  PendingFriendData,
  RequestedFriendData,
  UserProfileDataType,
} from '../types'
import { toast } from 'react-hot-toast'

export const getRecommendedFriendsList = () => {
  const uid = auth?.currentUser?.uid
  if (uid) {
  }
}

export const checkIfFriends = async (
  friendUsername: string
): Promise<FriendsStatusType | undefined> => {
  const currUsername = await getUsername()
  const uid = auth?.currentUser?.uid
  const friendUID = await getUIDFromUsername(friendUsername)
  if (uid && friendUID && currUsername) {
    try {
      const currUserProfileRef = doc(db, 'userProfileData', uid)
      const currUserFriendsRef = doc(currUserProfileRef, 'friends', friendUID)
      const currUserFriendsSnapshot = await getDoc(currUserFriendsRef)
      if (currUserFriendsSnapshot.exists()) {
        return 'friends'
      }
      const currUserPendingRef = doc(currUserProfileRef, 'pending', friendUID)
      const currUserPendingSnapshot = await getDoc(currUserPendingRef)
      if (currUserPendingSnapshot.exists()) {
        return 'pending'
      }

      const currUserRequestedRef = doc(
        currUserProfileRef,
        'requested',
        friendUID
      )
      const currUserRequestedSnapshot = await getDoc(currUserRequestedRef)
      if (currUserRequestedSnapshot.exists()) {
        return 'requested'
      }

      return 'not_friends'
    } catch (error: any) {
      const message = error.message || error
      console.log(message)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const addFriend = async (friendUsername: string) => {
  const uid = auth?.currentUser?.uid
  const currUsername = await getUsername()
  const friendUID = await getUIDFromUsername(friendUsername)
  if (uid && friendUID && currUsername) {
    try {
      const date = new Date().getTime()

      const currUserProfileRef = doc(db, 'userProfileData', uid)
      const currUserRequestedRef = doc(currUserProfileRef, 'pending', friendUID)
      const pendingData: PendingFriendData = {
        friendUID: friendUID,
        pendingUsername: friendUsername,
        datePending: date,
      }
      await setDoc(currUserRequestedRef, pendingData)

      const friendProfileRef = doc(db, 'userProfileData', friendUID)
      const friendPendingRequestRef = doc(friendProfileRef, 'requested', uid)
      const requestedData: RequestedFriendData = {
        friendUID: uid,
        requestedUsername: currUsername,
        dateRequested: date,
      }
      await setDoc(friendPendingRequestRef, requestedData)
    } catch (error: any) {
      const message = error.message || error
      console.log(message)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const acceptFriendRequest = async (friendUsername: string) => {
  const uid = auth?.currentUser?.uid
  const currUsername = await getUsername()
  const friendUID = await getUIDFromUsername(friendUsername)

  if (uid && friendUID && currUsername) {
    try {
      const currUserProfileRef = doc(db, 'userProfileData', uid)
      const currUserRequestedRef = doc(
        currUserProfileRef,
        'requested',
        friendUID
      )
      const currUserRequestedSnapshot = await getDoc(currUserRequestedRef)

      const friendProfileRef = doc(db, 'userProfileData', friendUID)
      const friendPendingRef = doc(friendProfileRef, 'pending', uid)
      const friendPendingSnapshot = await getDoc(friendPendingRef)
      console.log(currUserRequestedSnapshot.data())
      console.log(friendPendingSnapshot.data())
      if (
        currUserRequestedSnapshot.exists() &&
        friendPendingSnapshot.exists()
      ) {
        console.log('2')
        const date = new Date().getTime()
        const currUserFriendsRef = doc(currUserProfileRef, 'friends', friendUID)
        const currUserFriendData: FriendsData = {
          friendUID: friendUID,
          friendUsername: friendUsername,
          dateFriended: date,
        }
        await setDoc(currUserFriendsRef, currUserFriendData)
        console.log('3')

        const friendFriendsRef = doc(friendProfileRef, 'friends', uid)
        const friendFriendData: FriendsData = {
          friendUID: uid,
          friendUsername: currUsername,
          dateFriended: date,
        }
        await setDoc(friendFriendsRef, friendFriendData)

        console.log('4')
        await deleteDoc(currUserRequestedRef)
        console.log('5')
        await deleteDoc(friendPendingRef)
        console.log('6')
      } else {
        throw new Error(
          'Friendship does not exist, please refresh and try again'
        )
      }
    } catch (error: any) {
      const message = error.message || error
      console.log(message)
      toast.error(message, { position: 'bottom-center' })
    }
  }
}

export const getFriendRequests = async <
  B extends boolean | undefined
>(options: {
  returnUserData?: B
}): Promise<
  B extends true ? CombinedRequestedFriendDataType[] : RequestedFriendData[]
> => {
  const uid = auth?.currentUser?.uid
  if (uid) {
    try {
      const userProfileRef = doc(db, 'userProfileData', uid)
      const userFriendRequestsRef = collection(userProfileRef, 'requested')
      const q = query(
        userFriendRequestsRef,
        orderBy('dateRequested', 'desc'),
        limit(20)
      )
      const querySnapshot = await getDocs(q)
      const users: RequestedFriendData[] = []
      querySnapshot.forEach(doc => {
        users.push(doc.data() as RequestedFriendData)
      })

      if (options.returnUserData) {
        const userProfileDataRef = collection(db, 'userProfileData')
        const combinedUserData: CombinedRequestedFriendDataType[] =
          await Promise.all(
            users.map(
              async (
                user: RequestedFriendData
              ): Promise<CombinedRequestedFriendDataType> => {
                const friendUID = user.friendUID
                const userProfileDataDocRef = doc(userProfileDataRef, friendUID)
                const userProfileDataSnapshot = await getDoc(
                  userProfileDataDocRef
                )
                const userProfileData =
                  userProfileDataSnapshot.data() as UserProfileDataType
                const result: CombinedRequestedFriendDataType = {
                  ...user,
                  ...userProfileData,
                }
                return result
              }
            )
          )
        return combinedUserData
      } else {
        return users as any
      }
    } catch (error: any) {
      const message = error.message || error
      console.log(message)
      toast.error(message, { position: 'bottom-center' })
    }
  }
  return []
}

// export const getPendingFriendRequests = async <
//   B extends boolean | undefined
// >(options: {
//   returnUserData?: B
// }): Promise<
//   B extends true ? CombinedFriendDataType[] : UserFriendsListArrType[]
// > => {
//   const currUsername = await getUsername()
//   const uid: string = currUsername && await getUIDFromUsername(currUsername)
//   if (uid && currUsername) {
//     const userFriendsDocRef = doc(db, 'friends', currUsername)
//     const userFriendsDataRes = await getDoc(userFriendsDocRef)
//     if (!userFriendsDataRes.exists()) {
//       return []
//     }
//     const userFriendsData = userFriendsDataRes.data()
//     const userFriendsArr = Object.keys(userFriendsData).map(k => ({
//       ...userFriendsData[k],
//       username: k,
//     })) as UserFriendsListArrType[]
//     const pendingRequests = userFriendsArr.filter(
//       val => val.status === 'pending'
//     )

//     if (options.returnUserData) {
//       const userProfileDataRef = collection(db, 'userProfileData')
//       const combinedUserData: CombinedFriendDataType[] = await Promise.all(
//         pendingRequests.map(
//           async (
//             user: UserFriendsListArrType
//           ): Promise<CombinedFriendDataType> => {
//             const username = user.username
//             const userProfileDataDocRef = doc(userProfileDataRef, username)
//             const userProfileDataSnapshot = await getDoc(userProfileDataDocRef)
//             const userProfileData =
//               userProfileDataSnapshot.data() as UserProfileDataType
//             const result = {
//               ...user,
//               ...userProfileData,
//             }
//             return result
//           }
//         )
//       )
//       return combinedUserData
//     } else {
//       return pendingRequests as any
//     }
//   }
//   return [] as any
// }

// export const acceptFriendRequest = async (friendUsername: string) => {
//   const currUsername = await getUsername()
//   if (currUsername) {
//     const friendsDataDocRef = doc(db, 'friends', friendUsername)
//     const currUserDataDocRef = doc(db, 'friends', currUsername)

//     await setDoc(
//       friendsDataDocRef,
//       {
//         [currUsername]: 'friends' as FriendsStatusType,
//       },
//       { merge: true }
//     )
//     await setDoc(
//       currUserDataDocRef,
//       {
//         [friendUsername]: 'friends',
//       },
//       { merge: true }
//     )
//   }
// }