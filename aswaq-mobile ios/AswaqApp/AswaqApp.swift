import SwiftUI

@main
struct AswaqApp: App {
    @StateObject private var auth = AuthViewModel()
    var body: some Scene {
        WindowGroup {
            if auth.isLoggedIn {
                HomeView()
            } else {
                LoginView()
            }
        }
    }
}

// Simple Auth view model placeholder
final class AuthViewModel: ObservableObject {
    @Published var isLoggedIn: Bool = false
    // TODO: Implement Keychain storage & ConfigCat flag check
}
