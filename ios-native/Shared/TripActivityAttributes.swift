import ActivityKit
import Foundation

struct TripActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var meters: Double
        var status: String
    }
    var tripId: String
    var startDate: Date
}
