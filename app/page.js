"use client";

import React, { useEffect, useState, useRef } from "react";
import { initializeApp, getApps } from "firebase/app";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const firebaseConfig = {
  apiKey: "AIzaSyAssA5CA6slL3afb5Fny5t2lG3u2LgoF9o",
  authDomain: "yuktiherbs-84439.firebaseapp.com",
  projectId: "yuktiherbs-84439",
  storageBucket: "yuktiherbs-84439.appspot.com",
  messagingSenderId: "242581528273",
  appId: "1:242581528273:web:48dd0b105bfb0102b7aff0",
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const defaultMedicines = [
  { id: "1", name: "Livocure Syrup", dose: "10 ml", time: "08:00", taken: false },
  { id: "2", name: "Immuno Tabs", dose: "1 Tablet", time: "13:00", taken: false },
  { id: "3", name: "Trikatu Churna", dose: "5 g", time: "21:00", taken: false },
];

export default function Page() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [medicines, setMedicines] = useState(defaultMedicines);
  const [newName, setNewName] = useState("");
  const [newDose, setNewDose] = useState("");
  const [newTime, setNewTime] = useState("08:00");

  const timersRef = useRef({});

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setMedicines(defaultMedicines);
        clearAllTimers();
        return;
      }
      setUser(firebaseUser);
      const docRef = doc(db, "patients", firebaseUser.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setMedicines(snap.data().medicines);
      } else {
        await setDoc(docRef, { medicines: defaultMedicines });
        setMedicines(defaultMedicines);
      }
    });
    return () => unsub();
  }, []);

  function clearAllTimers() {
    Object.values(timersRef.current).forEach((t) => clearTimeout(t));
    timersRef.current = {};
  }

  useEffect(() => {
    if (!user || medicines.length === 0) return;

    clearAllTimers();

    medicines.forEach((med) => {
      scheduleReminder(med);
    });
  }, [medicines, user]);

  function scheduleReminder(med) {
    if (med.taken) return;

    const now = new Date();
    const [hours, minutes] = med.time.split(":").map(Number);

    let medTime = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hours,
      minutes,
      0,
      0
    );

    let reminderTime = new Date(medTime.getTime() - 5 * 60 * 1000);

    if (reminderTime <= now) {
      medTime = new Date(medTime.getTime() + 24 * 60 * 60 * 1000);
      reminderTime = new Date(medTime.getTime() - 5 * 60 * 1000);
    }

    const delay = reminderTime.getTime() - now.getTime();

    if (timersRef.current[med.id]) clearTimeout(timersRef.current[med.id]);

    timersRef.current[med.id] = setTimeout(() => {
      sendBrowserNotification(med);
    }, delay);
  }

  function sendBrowserNotification(med) {
    const title = "🌿 Ayurvedic Reminder";
    const options = {
      body: `Please take your medicine: ${med.name} (${med.dose}) at ${med.time}`,
      icon: "/pill-icon.png",
    };

    if (!("Notification" in window)) {
      toast.info(`Reminder: Take ${med.name} (${med.dose}) at ${med.time}`);
      return;
    }

    if (Notification.permission === "granted") {
      new Notification(title, options);
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((permission) => {
        if (permission === "granted") {
          new Notification(title, options);
        } else {
          toast.info(`Reminder: Take ${med.name} (${med.dose}) at ${med.time}`);
        }
      });
    } else {
      toast.info(`Reminder: Take ${med.name} (${med.dose}) at ${med.time}`);
    }
  }

  async function handleSignUp() {
    if (!email || !password) {
      toast.error("Please enter both Email & Password");
      return;
    }
    try {
      setLoading(true);
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "patients", cred.user.uid), { medicines: defaultMedicines });
      toast.success("🌸 Sign up successful! Welcome to YuktiTracker.");
      setError("");
    } catch (err) {
      toast.error("Oops! " + (err.message || "Failed to sign up"));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    if (!email || !password) {
      toast.error("Please enter both Email & Password");
      return;
    }
    try {
      setLoading(true);
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("🌿 Logged in successfully!");
      setError("");
    } catch {
      toast.error("Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    signOut(auth);
    clearAllTimers();
    toast.info("You have been logged out. Stay healthy 🌱");
  }

  async function toggleTaken(id) {
    if (!user) return;
    const updated = medicines.map((m) => (m.id === id ? { ...m, taken: !m.taken } : m));
    setMedicines(updated);
    await updateDoc(doc(db, "patients", user.uid), { medicines: updated });
  }

  async function addMedicine() {
    if (!newName.trim() || !newDose.trim() || !newTime) {
      toast.error("Please fill in all fields to add a medicine.");
      return;
    }
    const newMed = {
      id: Date.now().toString(),
      name: newName.trim(),
      dose: newDose.trim(),
      time: newTime,
      taken: false,
    };
    const updated = [...medicines, newMed];
    setMedicines(updated);
    setNewName("");
    setNewDose("");
    setNewTime("08:00");
    setError("");
    if (user) await updateDoc(doc(db, "patients", user.uid), { medicines: updated });
    toast.success("🌼 Medicine added successfully!");
  }

  async function deleteMedicine(id) {
    if (!user) return;
    const updated = medicines.filter((m) => m.id !== id);
    setMedicines(updated);
    await updateDoc(doc(db, "patients", user.uid), { medicines: updated });
    toast.success("Medicine removed. Take care!");
  }

  async function sendReminderEmailForAll() {
    if (!user || !medicines || medicines.length === 0) {
      toast.error("No medicines found to send reminders.");
      return;
    }

    for (const med of medicines) {
      try {
        const response = await fetch('/api/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: user.email,
            medicineName: med.name,
            dose: med.dose,
            time: med.time,
          }),
        });

        const data = await response.json();
        console.log(`Email sent for ${med.name}:`, data);
      } catch (error) {
        console.error(`Failed to send email for ${med.name}:`, error);
      }
    }

    toast.success("🌟 Reminder emails sent successfully!");
  }

  return (
    <main className="max-w-lg mx-auto p-6 font-sans bg-amber-50 min-h-screen text-amber-900">
      <ToastContainer position="top-right" autoClose={5000} />

      {/* Branding Header */}
      <header className="mb-8 text-center">
        <h1 className="text-5xl font-extrabold mb-2" style={{ fontFamily: "'Georgia', serif" }}>
          YuktiTracker 
        </h1>
        <p className="text-lg max-w-md mx-auto text-amber-700 italic">
          Ayurveda-inspired medicine tracker for your daily health and wellness.
        </p>
        <p className="mt-1 text-sm font-bold font-poppins">
  
</p>

      </header>

      {!user ? (
        <>
          <section
            className="mb-6 p-5 bg-amber-100 rounded-lg shadow-md"
            aria-label="Authentication form"
          >
            <h2 className="text-2xl font-semibold mb-4 text-amber-800" style={{ fontFamily: "'Georgia', serif" }}>
              Welcome! Please login or sign up
            </h2>
            <label className="block mb-2 font-medium" htmlFor="emailInput">
               Email
            </label>
            <input
              id="emailInput"
              type="email"
              placeholder="example@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-4 mb-4 rounded border border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600 text-amber-900 font-medium"
              aria-describedby="emailHelp"
              autoComplete="email"
            />
            <small id="emailHelp" className="block mb-4 text-amber-600">
              Use your email to keep your medicines safe.
            </small>

            <label className="block mb-2 font-medium" htmlFor="passwordInput">
               Password
            </label>
            <input
              id="passwordInput"
              type="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-4 mb-6 rounded border border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600 text-amber-900 font-medium"
              aria-describedby="passwordHelp"
              autoComplete="current-password"
            />
            <small id="passwordHelp" className="block mb-6 text-amber-600">
              Choose a secure password to protect your info.
            </small>

            <div className="flex gap-4">
              <button
                onClick={handleLogin}
                disabled={loading}
                className="flex-grow py-4 rounded bg-amber-700 hover:bg-amber-600 transition text-white font-bold shadow-md"
              >
                Login
              </button>
              <button
                onClick={handleSignUp}
                disabled={loading}
                className="flex-grow py-4 rounded bg-green-600 hover:bg-green-500 transition text-white font-bold shadow-md"
              >
                Sign Up
              </button>
            </div>
          </section>
        </>
      ) : (
        <>
          <section className="mb-8 p-5 bg-amber-100 rounded-lg shadow-md">
            <div className="flex justify-between items-center mb-4">
              <p className="font-semibold text-md" aria-live="polite">
                🙏 Welcome, <span className="italic">{user.email}</span>
              </p>
              <button
                onClick={handleLogout}
                className="text-black font-semibold "
                aria-label="Logout"
              >
                Logout
              </button>
            </div>

            {/* Medicine List */}
            <div>
              <h2 className="text-xl font-semibold mb-4 text-amber-800" style={{ fontFamily: "'Georgia', serif" }}>
                Your Ayurvedic Medicines 
              </h2>
              {medicines.length === 0 && (
                <p className="text-amber-700 italic">You have no medicines added yet.</p>
              )}
              <ul className="space-y-5">
                {medicines.map((med) => (
                  <li
                    key={med.id}
                    className=" justify-between items-center p-4 rounded bg-amber-200 border border-amber-400 shadow-inner"
                    aria-label={`Medicine ${med.name}`}
                  >
                    <div className="flex flex-wrap gap-5 justify-center mx-auto max-w-full p-2">
  <div className="min-w-0">
    <p className="text-2xl font-bold break-words">{med.name}</p>
  </div>
  <div className="min-w-0">
    <p className="text-md font-semibold text-amber-700 break-words">
      Dose:<br />{med.dose}
    </p>
  </div>
  <div className="min-w-0">
    <p className="text-md font-semibold text-amber-700 break-words">
      Time:<br />{med.time}
    </p>
  </div>
</div>

                    <div className="flex items-center place-content-center mx-auto pt-4 gap-3">
                      <button
                        onClick={() => toggleTaken(med.id)}
                        className={`px-4 py-2 text-[15px] rounded font-semibold transition shadow-md
                          ${
                            med.taken
                              ? " bg-green-600 hover:bg-green-500 text-white"
                              : "bg-yellow-500 hover:bg-yellow-400 text-amber-900"
                          }
                        `}
                        aria-pressed={med.taken}
                        aria-label={med.taken ? "Mark as not taken" : "Mark as taken"}
                      >
                        {med.taken ? "Taken " : "Mark Taken "}
                      </button>
                      <button
                        onClick={() => deleteMedicine(med.id)}
                        className="px-4  text-[15px] py-2 rounded bg-red-500 hover:bg-red-400 text-white font-semibold shadow-md"
                        aria-label={`Delete medicine ${med.name}`}
                      >
                        Delete 
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Add New Medicine */}
          <section className="mb-8 p-5 bg-amber-100 rounded-lg shadow-md" aria-label="Add new medicine form">
            <h2 className="text-2xl font-semibold mb-4 text-amber-800" style={{ fontFamily: "'Georgia', serif" }}>
              Add New Medicine 🌸
            </h2>
            <p className="mb-6 text-amber-700 italic max-w-lg">
              Fill in the details below to add your Ayurvedic medicine. Use simple names and doses you understand.
            </p>
            <div className="space-y-4 max-w-lg">
              <label className="block font-medium" htmlFor="newNameInput">
                Medicine Name
              </label>
              <input
                id="newNameInput"
                type="text"
                placeholder="E.g., Ashwagandha powder"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full p-4 rounded border border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600 text-amber-900 font-medium"
                aria-describedby="nameHelp"
              />
              <small id="nameHelp" className="block mb-2 text-amber-600">
                Name of the medicine or herb.
              </small>

              <label className="block font-medium" htmlFor="newDoseInput">
                Dose (Quantity)
              </label>
              <input
                id="newDoseInput"
                type="text"
                placeholder="E.g., 10 ml, 1 tsp, 2 tablets"
                value={newDose}
                onChange={(e) => setNewDose(e.target.value)}
                className="w-full p-4 rounded border border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600 text-amber-900 font-medium"
                aria-describedby="doseHelp"
              />
              <small id="doseHelp" className="block mb-2 text-amber-600">
                How much you take each time.
              </small>

              <label className="block font-medium" htmlFor="newTimeInput">
                Time to Take Medicine
              </label>
              <input
                id="newTimeInput"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="w-full p-4 rounded border border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-600 text-amber-900 font-medium"
              />
              <small className="block mb-4 text-amber-600">
                Select the time you want to be reminded.
              </small>

              <button
                onClick={addMedicine}
                className="w-full py-4 rounded bg-green-600 hover:bg-green-500 text-white font-bold shadow-md transition"
              >
                Add Medicine 🌿
              </button>
            </div>
          </section>

          {/* Send Email Reminders */}
          <section className="mb-8 p-5 bg-amber-100 rounded-lg shadow-md">
            <button
              onClick={sendReminderEmailForAll}
              className="w-full py-4 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-bold shadow-md transition"
              aria-label="Send reminder emails for all medicines"
            >
              Send Reminder Emails ✉️
            </button>
            <p className="mt-2 text-sm text-amber-700 italic">
              You will receive reminder emails for all your medicines.
            </p>
          </section>

          {/* Help Section */}
          <section className="text-left mt-12 p-6 bg-amber-200 rounded-lg shadow-md max-w-lg mx-auto">
            <h3 className="text-2xl font-semibold mb-3">How to Use YuktiTracker</h3>
            <p className="mb-3 text-amber-900">
              1. Login or sign up with your email.
              <br />
              2. Add your Ayurvedic medicines with simple names and doses.
              <br />
              3. Set the time you want to take each medicine.
              <br />
              4. Mark medicines as taken when you consume them.
              <br />
              5. Use the reminder emails to never miss a dose!
            </p>
            <p className="italic text-amber-800">
              “Health is the greatest gift. Nurture it daily with YuktiTracker.” 🌱
            </p>
          </section>
          <div className="pt-5 text-center">
            <a
    href="https://rctechsolutions.com" // Replace with your URL or portfolio
    target="_blank"
    rel="noopener noreferrer"
    className="text-purple-600 bg-purple-100 px-3 py-1 rounded hover:bg-purple-200 transition inline-block"
  >
    Developed with ❤️ by Rahul Chauhan
  </a>
          </div>
        </>
      )}
    </main>
  );
}
