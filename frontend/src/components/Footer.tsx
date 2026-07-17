export default function Footer() {
  return (
    <footer className="footer no-print">
      <div className="container">
        <div className="footer-content">
          <div className="footer-left">
            <a href="https://cascate.ru" className="footer-logo" target="_blank" rel="noopener noreferrer">
              <img src="/logo-footer.png" alt="Cascate Porte e mobile" className="footer-logo-image" />
            </a>
            <p className="footer-brand-name">Cascate porte e mobile</p>
            <p className="footer-note">* Соцсеть запрещена на территории РФ</p>
          </div>

          <div className="footer-center">
            <div className="footer-links">
              <a href="https://cascate.ru/login/" className="footer-link" target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Личный кабинет
              </a>
              <a href="https://cascate.ru/page/contacts/" className="footer-link" target="_blank" rel="noopener noreferrer">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
                Контакты
              </a>
            </div>

            <div className="footer-info">
              <div className="footer-info-row">
                <span className="footer-info-text">
                  <a href="https://yandex.ru/maps/org/cascate_porte/191571852066/" target="_blank" rel="noopener noreferrer">
                    г. Москва, проспект Маршала Жукова д.59
                  </a>
                </span>
                <span className="footer-info-text">
                  тел. Call-центр — <a href="tel:+78002340173">+7 800 234 01 73</a>
                </span>
                <span className="footer-info-text">
                  <a href="mailto:store@cascate.ru">store@cascate.ru</a>
                </span>
              </div>
              <div className="footer-info-row">
                <span className="footer-info-text">
                  <a href="https://yandex.ru/maps/org/cascate_porte_e_mobile/144208528535/" target="_blank" rel="noopener noreferrer">
                    г. Москва, Олимпийский проспект, 22
                  </a>
                </span>
              </div>
            </div>
          </div>

          <div className="footer-right">
            <div className="footer-social">
              <a href="https://www.youtube.com/channel/UCj-V7Fi3Z5qM1eGEvWQODIg" className="social-icon" target="_blank" rel="noopener noreferrer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/cascate_porte_russia" className="social-icon" target="_blank" rel="noopener noreferrer">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                  <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                  <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
