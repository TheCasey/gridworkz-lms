import { useMemo } from 'react';
import { ArrowRight, Delete } from 'lucide-react';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'delete', '0', 'submit'];

const StudentPortalPinGate = ({ studentName, pin, error, onPinChange, onSubmit }) => {
  const dots = useMemo(() => Array.from({ length: 6 }, (_, index) => index < pin.length), [pin.length]);

  const handleKey = (key) => {
    if (key === 'delete') {
      onPinChange(pin.slice(0, -1));
      return;
    }

    if (key === 'submit') {
      onSubmit({ preventDefault: () => {} });
      return;
    }

    if (pin.length < 6) {
      onPinChange(`${pin}${key}`);
    }
  };

  return (
    <main className="student-pin-gate">
      <section className="student-pin-intro" aria-label="OwnPath student portal introduction">
        <div className="student-pin-brand">OwnPath · Student Portal</div>
        <div>
          <h1>Your week.<br />Your order.</h1>
          <p>Choose the school blocks, routines, and chores you want to tackle next.</p>
        </div>
        <p className="student-pin-private">Private household access · Mobile ready</p>
      </section>

      <section className="student-pin-panel">
        <form className="student-pin-form" onSubmit={onSubmit}>
          <p className="student-eyebrow">{studentName}&apos;s portal</p>
          <h2>Welcome back, {studentName}</h2>
          <p className="student-muted">Enter your 4–6 digit PIN to continue.</p>

          {error ? <div className="student-error" role="alert">{error}</div> : null}

          <label className="sr-only" htmlFor="student-pin-input">Student PIN</label>
          <input
            id="student-pin-input"
            className="student-pin-native-input"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{4,6}"
            required
            maxLength={6}
            value={pin}
            onChange={(event) => onPinChange(event.target.value.replace(/\D/g, '').slice(0, 6))}
          />

          <div className="student-pin-dots" aria-hidden="true">
            {dots.map((filled, index) => <span key={index} className={filled ? 'is-filled' : ''} />)}
          </div>

          <div className="student-pin-keypad">
            {KEYS.map((key) => (
              <button
                key={key}
                type={key === 'submit' ? 'submit' : 'button'}
                aria-label={key === 'delete' ? 'Delete digit' : key === 'submit' ? 'Enter portal' : `Digit ${key}`}
                onClick={key === 'submit' ? undefined : () => handleKey(key)}
              >
                {key === 'delete' ? <Delete /> : key === 'submit' ? <ArrowRight /> : key}
              </button>
            ))}
          </div>
        </form>
      </section>
    </main>
  );
};

export default StudentPortalPinGate;
