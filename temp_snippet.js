
// Waitlist State
const [waitlistEmail, setWaitlistEmail] = useState('');
const [waitlistJoined, setWaitlistJoined] = useState(false);

const handleWaitlistSubmit = (e) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setWaitlistJoined(true);
    setWaitlistEmail('');
};
