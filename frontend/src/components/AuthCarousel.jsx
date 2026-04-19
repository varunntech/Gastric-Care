import { useState, useEffect } from 'react'
import loginImg from '../assets/login.jpg'
import signupImg from '../assets/signup.jpeg'
import '../App.css' // Ensure we have access to styles

const images = [
    { src: loginImg, alt: 'Gastric Cancer Risk Assessment' },
    { src: signupImg, alt: 'Healthcare Analysis' }
]

const AuthCarousel = () => {
    const [currentIndex, setCurrentIndex] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length)
        }, 5000)

        return () => clearInterval(interval)
    }, [])

    return (
        <div className="auth-carousel">
            {images.map((img, index) => (
                <div
                    key={index}
                    className={`carousel-slide ${index === currentIndex ? 'active' : ''}`}
                    style={{ backgroundImage: `url(${img.src})` }}
                >
                    <div className="image-overlay">
                        <div className="image-caption">
                            <h2>Capturing health data, creating insight</h2>
                            <p>Secure access to your gastric cancer prediction dashboard.</p>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default AuthCarousel
