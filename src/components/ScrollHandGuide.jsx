import { useEffect, useRef, useState } from 'react';

const ScrollHandGuide = () => {
    const [pullDistance, setPullDistance] = useState(0);
    const [pulling, setPulling] = useState(false);
    const [settling, setSettling] = useState(false);
    const [gripping, setGripping] = useState(false);
    const startY = useRef(null);
    const settleTimer = useRef(null);

    useEffect(() => {
        const handleTouchStart = event => {
            if (window.scrollY <= 2 && event.touches.length === 1) {
                startY.current = event.touches[0].clientY;
                setSettling(false);
            }
        };

        const handleTouchMove = event => {
            if (startY.current === null || window.scrollY > 2 || event.touches.length !== 1) return;
            const distance = event.touches[0].clientY - startY.current;
            if (distance <= 8) return;
            const nextDistance = Math.min(distance, 220);
            setPulling(true);
            setPullDistance(nextDistance);
            setGripping(nextDistance >= 105);
        };

        const handleTouchEnd = () => {
            if (startY.current === null) return;
            startY.current = null;
            setPulling(currentlyPulling => {
                if (!currentlyPulling) return false;
                setSettling(true);
                setGripping(true);
                clearTimeout(settleTimer.current);
                settleTimer.current = window.setTimeout(() => {
                    setPulling(false);
                    setSettling(false);
                    setGripping(false);
                    setPullDistance(0);
                }, 700);
                return true;
            });
        };

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, { passive: true });
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: true });
        return () => {
            clearTimeout(settleTimer.current);
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, []);

    const className = `scroll-hand-guide${pulling ? ' is-pulling' : ''}${settling ? ' is-settling' : ''}${gripping ? ' is-gripping' : ''}`;
    return (
        <div className={className} style={{ '--pull-distance': `${pullDistance}px` }} aria-hidden="true">
            <img className="scroll-hand-open" src="/scroll-hand.svg" alt="" />
            <img className="scroll-hand-closed" src="/scroll-hand-grip.svg" alt="" />
        </div>
    );
};

export default ScrollHandGuide;
