if(NOT TARGET reanimated::reanimated)
add_library(reanimated::reanimated INTERFACE IMPORTED)
set_target_properties(reanimated::reanimated PROPERTIES
    INTERFACE_INCLUDE_DIRECTORIES "/Users/apple/RoughTurf/TurfMobile/mobile/node_modules/react-native-reanimated/android/build/prefab-headers/reanimated"
    INTERFACE_LINK_LIBRARIES ""
)
endif()

